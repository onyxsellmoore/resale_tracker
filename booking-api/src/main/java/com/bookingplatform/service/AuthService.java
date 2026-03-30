package com.bookingplatform.service;

import com.bookingplatform.model.*;
import com.bookingplatform.repository.OrganizationRepository;
import com.bookingplatform.repository.RefreshTokenRepository;
import com.bookingplatform.repository.UserRepository;
import com.bookingplatform.repository.WebAuthnCredentialRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.cbor.CBORFactory;
import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@ApplicationScoped
public class AuthService {

    private static final Logger LOG = Logger.getLogger(AuthService.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final ObjectMapper CBOR_MAPPER = new ObjectMapper(new CBORFactory());

    @Inject
    OrganizationRepository organizationRepository;

    @Inject
    UserRepository userRepository;

    @Inject
    WebAuthnCredentialRepository credentialRepository;

    @Inject
    RefreshTokenRepository refreshTokenRepository;

    @ConfigProperty(name = "booking.jwt.secret")
    String jwtSecret;

    @ConfigProperty(name = "booking.jwt.expiry-minutes", defaultValue = "15")
    int jwtExpiryMinutes;

    @ConfigProperty(name = "booking.webauthn.rp-id", defaultValue = "localhost")
    String rpId;

    @ConfigProperty(name = "booking.webauthn.rp-name", defaultValue = "Inventory Ledger")
    String rpName;

    @ConfigProperty(name = "booking.webauthn.origin", defaultValue = "http://localhost:5173")
    String expectedOrigin;

    @ConfigProperty(name = "booking.webauthn.allowed-origins")
    String allowedOriginsRaw;

    private Set<String> allowedOrigins;

    @PostConstruct
    void init() {
        allowedOrigins = new HashSet<>();
        for (String entry : allowedOriginsRaw.split(",")) {
            String trimmed = entry.trim().toLowerCase();
            if (trimmed.isEmpty()) {
                LOG.warn("Empty entry in booking.webauthn.allowed-origins — skipping");
                continue;
            }
            allowedOrigins.add(trimmed);
        }
        if (allowedOrigins.isEmpty()) {
            throw new IllegalStateException(
                    "booking.webauthn.allowed-origins must contain at least one valid origin");
        }
        LOG.infof("WebAuthn allowed origins: %s", allowedOrigins);
    }

    public boolean isAllowedOrigin(String origin) {
        if (origin == null) return false;
        return allowedOrigins.contains(origin.toLowerCase());
    }

    // Challenge store — in production use Redis or DB with TTL
    private final Map<String, ChallengeData> challenges = new java.util.concurrent.ConcurrentHashMap<>();
    private static final int MAX_CHALLENGES = 10000;

    // EC P-256 SubjectPublicKeyInfo DER header (26 bytes) + 0x04 uncompressed point prefix
    private static final byte[] EC_P256_DER_PREFIX = {
        0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, (byte)0x86, 0x48, (byte)0xce, 0x3d, 0x02, 0x01,
        0x06, 0x08, 0x2a, (byte)0x86, 0x48, (byte)0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00, 0x04
    };

    public record TokenPair(String accessToken, String refreshToken) {}
    public record ChallengeData(String challenge, String userId, Instant expiresAt) {}
    public record RegisterResult(String orgId, String userId, String role) {}

    public enum LoginBeginStatus { SUCCESS, USER_NOT_FOUND, NO_PASSKEY }
    public record LoginBeginResult(LoginBeginStatus status, Map<String, Object> options) {}

    // --- Register (org + first admin user, no password) ---
    public Optional<RegisterResult> register(String orgName, String orgSlug,
                                              String adminEmail, String adminDisplayName) {
        if (organizationRepository.findBySlug(orgSlug).isPresent()) {
            return Optional.empty();
        }

        Organization org = new Organization();
        org.name = orgName;
        org.slug = orgSlug;
        org.createdAt = Instant.now();
        organizationRepository.persist(org);

        User user = new User();
        user.orgId = org.id;
        user.email = adminEmail;
        user.displayName = adminDisplayName;
        user.role = Role.ADMIN;
        user.createdAt = Instant.now();
        userRepository.persist(user);

        return Optional.of(new RegisterResult(
                org.id.toHexString(), user.id.toHexString(), "ADMIN"));
    }

    // --- Register Begin (WebAuthn passkey registration) ---
    public Optional<Map<String, Object>> registerBegin(String email) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }

        User user = userOpt.get();

        evictExpiredChallenges();
        if (challenges.size() >= MAX_CHALLENGES) {
            return Optional.empty();
        }

        byte[] challengeBytes = new byte[32];
        new SecureRandom().nextBytes(challengeBytes);
        String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes);

        challenges.put(challenge, new ChallengeData(challenge, user.id.toHexString(),
                Instant.now().plus(5, ChronoUnit.MINUTES)));

        return Optional.of(Map.of(
                "challenge", challenge,
                "rp", Map.of("id", rpId, "name", rpName),
                "user", Map.of(
                        "id", Base64.getUrlEncoder().withoutPadding()
                                .encodeToString(user.id.toHexString().getBytes(StandardCharsets.UTF_8)),
                        "name", user.email,
                        "displayName", user.displayName
                ),
                "pubKeyCredParams", List.of(Map.of("type", "public-key", "alg", -7)),
                "timeout", 60000,
                "attestation", "none"
        ));
    }

    // --- Register Complete (verify attestation, store credential, issue tokens) ---
    public Optional<TokenPair> registerComplete(String email, String credentialId,
                                                 String attestationObjectB64, String clientDataJSONB64) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }

        User user = userOpt.get();

        try {
            // 1. Decode and verify clientDataJSON
            byte[] clientDataBytes = Base64.getUrlDecoder().decode(clientDataJSONB64);
            String clientDataStr = new String(clientDataBytes, StandardCharsets.UTF_8);
            JsonNode clientData = MAPPER.readTree(clientDataStr);

            String type = clientData.has("type") ? clientData.get("type").asText() : null;
            if (!"webauthn.create".equals(type)) {
                return Optional.empty();
            }

            String origin = clientData.has("origin") ? clientData.get("origin").asText() : null;
            if (!isAllowedOrigin(origin)) {
                return Optional.empty();
            }

            String challengeFromClient = clientData.has("challenge") ? clientData.get("challenge").asText() : null;
            if (challengeFromClient == null) {
                return Optional.empty();
            }

            ChallengeData challengeData = challenges.remove(challengeFromClient);
            if (challengeData == null || challengeData.expiresAt().isBefore(Instant.now())) {
                return Optional.empty();
            }

            if (!challengeData.userId().equals(user.id.toHexString())) {
                return Optional.empty();
            }

            // 2. Decode attestationObject (CBOR)
            byte[] attestationBytes = Base64.getUrlDecoder().decode(attestationObjectB64);
            JsonNode attestation = CBOR_MAPPER.readTree(attestationBytes);

            byte[] authData = attestation.get("authData").binaryValue();

            // 3. Parse authData
            if (authData.length < 37) {
                return Optional.empty();
            }

            // rpIdHash check
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] expectedRpIdHash = sha256.digest(rpId.getBytes(StandardCharsets.UTF_8));
            byte[] actualRpIdHash = Arrays.copyOfRange(authData, 0, 32);
            if (!MessageDigest.isEqual(expectedRpIdHash, actualRpIdHash)) {
                return Optional.empty();
            }

            // flags — UP (bit 0) must be set
            byte flags = authData[32];
            if ((flags & 0x01) == 0) {
                return Optional.empty();
            }

            // Attested credential data must be present (bit 6)
            if ((flags & 0x40) == 0) {
                return Optional.empty();
            }

            // Skip signCount (bytes 33-36), AAGUID (bytes 37-52)
            int offset = 53;

            // credIdLen (big-endian uint16)
            int credIdLen = ((authData[offset] & 0xFF) << 8) | (authData[offset + 1] & 0xFF);
            offset += 2;

            // credentialId bytes
            byte[] credIdBytes = Arrays.copyOfRange(authData, offset, offset + credIdLen);
            String extractedCredId = Base64.getUrlEncoder().withoutPadding().encodeToString(credIdBytes);
            if (!extractedCredId.equals(credentialId)) {
                return Optional.empty();
            }
            offset += credIdLen;

            // 4. Parse COSE key (remaining authData bytes)
            byte[] coseKeyBytes = Arrays.copyOfRange(authData, offset, authData.length);
            JsonNode coseKey = CBOR_MAPPER.readTree(coseKeyBytes);

            // Verify kty(1)==2(EC), alg(3)==-7(ES256), crv(-1)==1(P-256)
            if (coseKey.get("1").asInt() != 2 || coseKey.get("3").asInt() != -7 || coseKey.get("-1").asInt() != 1) {
                return Optional.empty();
            }

            byte[] x = coseKey.get("-2").binaryValue();
            byte[] y = coseKey.get("-3").binaryValue();

            if (x.length != 32 || y.length != 32) {
                return Optional.empty();
            }

            // 5. Convert to X.509 SubjectPublicKeyInfo DER
            byte[] derKey = new byte[EC_P256_DER_PREFIX.length + 64];
            System.arraycopy(EC_P256_DER_PREFIX, 0, derKey, 0, EC_P256_DER_PREFIX.length);
            System.arraycopy(x, 0, derKey, EC_P256_DER_PREFIX.length, 32);
            System.arraycopy(y, 0, derKey, EC_P256_DER_PREFIX.length + 32, 32);

            String publicKeyB64 = Base64.getUrlEncoder().withoutPadding().encodeToString(derKey);

            // 6. Check no existing credential for this credentialId
            if (credentialRepository.findByCredentialId(credentialId).isPresent()) {
                return Optional.empty();
            }

            // 7. Persist credential
            WebAuthnCredential cred = new WebAuthnCredential();
            cred.ownerId = user.id.toHexString();
            cred.credentialId = credentialId;
            cred.publicKey = publicKeyB64;
            cred.signCount = 0;
            cred.createdAt = Instant.now();
            credentialRepository.persist(cred);

            // 8. Return tokens
            return Optional.of(generateTokens(user));

        } catch (Exception e) {
            return Optional.empty();
        }
    }

    // --- Generate JWT for User ---
    public String generateUserJwt(User user) {
        try {
            JWTClaimsSet claims = new JWTClaimsSet.Builder()
                    .subject(user.id.toHexString())
                    .claim("orgId", user.orgId.toHexString())
                    .claim("role", user.role.name())
                    .claim("email", user.email)
                    .issueTime(new Date())
                    .expirationTime(Date.from(Instant.now().plus(jwtExpiryMinutes, ChronoUnit.MINUTES)))
                    .build();

            JWSHeader header = new JWSHeader(JWSAlgorithm.HS256);
            SignedJWT signedJWT = new SignedJWT(header, claims);
            signedJWT.sign(new MACSigner(getSecretBytes()));

            return signedJWT.serialize();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate JWT", e);
        }
    }

    // --- Generate JWT + Refresh Token for User ---
    public TokenPair generateTokens(User user) {
        try {
            String accessToken = generateUserJwt(user);

            // Generate opaque refresh token
            String rawRefreshToken = UUID.randomUUID().toString();
            String tokenHash = sha256Hash(rawRefreshToken);

            RefreshToken rt = new RefreshToken();
            rt.tokenHash = tokenHash;
            rt.ownerId = user.id.toHexString();
            rt.businessId = user.orgId.toHexString();
            rt.expiresAt = Instant.now().plus(7, ChronoUnit.DAYS);
            rt.revoked = false;
            rt.createdAt = Instant.now();
            refreshTokenRepository.persist(rt);

            return new TokenPair(accessToken, rawRefreshToken);

        } catch (Exception e) {
            throw new RuntimeException("Failed to generate tokens", e);
        }
    }

    // --- Login Begin (WebAuthn) ---
    public LoginBeginResult loginBeginWithStatus(String email) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return new LoginBeginResult(LoginBeginStatus.USER_NOT_FOUND, null);
        }

        User user = userOpt.get();
        List<WebAuthnCredential> credentials = credentialRepository.findByOwnerId(user.id.toHexString());
        if (credentials.isEmpty()) {
            return new LoginBeginResult(LoginBeginStatus.NO_PASSKEY, null);
        }

        evictExpiredChallenges();
        if (challenges.size() >= MAX_CHALLENGES) {
            return new LoginBeginResult(LoginBeginStatus.USER_NOT_FOUND, null);
        }

        byte[] challengeBytes = new byte[32];
        new SecureRandom().nextBytes(challengeBytes);
        String challenge = Base64.getUrlEncoder().withoutPadding().encodeToString(challengeBytes);

        challenges.put(challenge, new ChallengeData(challenge, user.id.toHexString(),
                Instant.now().plus(5, ChronoUnit.MINUTES)));

        List<Map<String, String>> allowCredentials = credentials.stream()
                .map(c -> Map.of("id", c.credentialId, "type", "public-key"))
                .toList();

        return new LoginBeginResult(LoginBeginStatus.SUCCESS, Map.of(
                "challenge", challenge,
                "rpId", rpId,
                "allowCredentials", allowCredentials,
                "timeout", 60000
        ));
    }

    public Optional<Map<String, Object>> loginBegin(String email) {
        LoginBeginResult result = loginBeginWithStatus(email);
        if (result.status() == LoginBeginStatus.SUCCESS) {
            return Optional.of(result.options());
        }
        return Optional.empty();
    }

    // --- Login with Password ---
    public Optional<TokenPair> loginWithPassword(String email, String password) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) return Optional.empty();
        User user = userOpt.get();
        if (user.temporaryPasswordHash == null || user.temporaryPasswordSalt == null) return Optional.empty();
        String candidate = sha256Hex(user.temporaryPasswordSalt + password);
        if (!candidate.equals(user.temporaryPasswordHash)) return Optional.empty();
        return Optional.of(generateTokens(user));
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    // --- Login Complete (WebAuthn) ---
    public Optional<TokenPair> loginComplete(String email, String credentialId,
                                              String authenticatorData, String clientDataJSON,
                                              String signature) {
        Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return Optional.empty();
        }

        User user = userOpt.get();
        Optional<WebAuthnCredential> credOpt = credentialRepository.findByCredentialId(credentialId);
        if (credOpt.isEmpty() || !credOpt.get().ownerId.equals(user.id.toHexString())) {
            return Optional.empty();
        }

        try {
            byte[] clientDataBytes = Base64.getUrlDecoder().decode(clientDataJSON);
            String clientDataStr = new String(clientDataBytes, StandardCharsets.UTF_8);

            JsonNode clientData = MAPPER.readTree(clientDataStr);

            String type = clientData.has("type") ? clientData.get("type").asText() : null;
            if (!"webauthn.get".equals(type)) {
                return Optional.empty();
            }

            String origin = clientData.has("origin") ? clientData.get("origin").asText() : null;
            if (!isAllowedOrigin(origin)) {
                return Optional.empty();
            }

            String challengeFromClient = clientData.has("challenge") ? clientData.get("challenge").asText() : null;
            if (challengeFromClient == null) {
                return Optional.empty();
            }

            ChallengeData challengeData = challenges.remove(challengeFromClient);
            if (challengeData == null || challengeData.expiresAt().isBefore(Instant.now())) {
                return Optional.empty();
            }

            if (!challengeData.userId().equals(user.id.toHexString())) {
                return Optional.empty();
            }

            WebAuthnCredential cred = credOpt.get();
            byte[] authDataBytes = Base64.getUrlDecoder().decode(authenticatorData);
            byte[] sigBytes = Base64.getUrlDecoder().decode(signature);

            if (authDataBytes.length < 37) {
                return Optional.empty();
            }
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] expectedRpIdHash = sha256.digest(rpId.getBytes(StandardCharsets.UTF_8));
            byte[] actualRpIdHash = Arrays.copyOfRange(authDataBytes, 0, 32);
            if (!MessageDigest.isEqual(expectedRpIdHash, actualRpIdHash)) {
                return Optional.empty();
            }

            long incomingSignCount = ((authDataBytes[33] & 0xFFL) << 24) |
                                     ((authDataBytes[34] & 0xFFL) << 16) |
                                     ((authDataBytes[35] & 0xFFL) << 8) |
                                      (authDataBytes[36] & 0xFFL);
            if (incomingSignCount != 0 && incomingSignCount <= cred.signCount) {
                return Optional.empty();
            }

            byte[] clientDataHash = sha256.digest(clientDataBytes);

            byte[] verificationData = new byte[authDataBytes.length + clientDataHash.length];
            System.arraycopy(authDataBytes, 0, verificationData, 0, authDataBytes.length);
            System.arraycopy(clientDataHash, 0, verificationData, authDataBytes.length, clientDataHash.length);

            byte[] publicKeyBytes = Base64.getUrlDecoder().decode(cred.publicKey);
            KeyFactory keyFactory = KeyFactory.getInstance("EC");
            java.security.spec.X509EncodedKeySpec keySpec =
                    new java.security.spec.X509EncodedKeySpec(publicKeyBytes);
            PublicKey publicKey = keyFactory.generatePublic(keySpec);

            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(publicKey);
            verifier.update(verificationData);

            if (!verifier.verify(sigBytes)) {
                return Optional.empty();
            }

            cred.signCount = incomingSignCount;
            credentialRepository.update(cred);

            return Optional.of(generateTokens(user));

        } catch (Exception e) {
            return Optional.empty();
        }
    }

    // --- Refresh (single-use: revoke on use, issue new access token) ---
    public Optional<String> refresh(String rawRefreshToken) {
        String tokenHash = sha256Hash(rawRefreshToken);
        Optional<RefreshToken> rtOpt = refreshTokenRepository.findByTokenHash(tokenHash);

        if (rtOpt.isEmpty()) {
            return Optional.empty();
        }

        RefreshToken rt = rtOpt.get();
        if (rt.revoked || rt.expiresAt.isBefore(Instant.now())) {
            return Optional.empty();
        }

        // Revoke immediately (single-use token rotation)
        rt.revoked = true;
        refreshTokenRepository.update(rt);

        User user = userRepository.findById(new org.bson.types.ObjectId(rt.ownerId));
        if (user == null) {
            return Optional.empty();
        }

        try {
            return Optional.of(generateUserJwt(user));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    // --- Logout ---
    public void logout(String rawRefreshToken) {
        String tokenHash = sha256Hash(rawRefreshToken);
        Optional<RefreshToken> rtOpt = refreshTokenRepository.findByTokenHash(tokenHash);
        rtOpt.ifPresent(rt -> {
            rt.revoked = true;
            refreshTokenRepository.update(rt);
        });
    }

    // --- JWT Verification ---
    public Optional<JWTClaimsSet> verifyToken(String token) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(token);
            JWSVerifier verifier = new MACVerifier(getSecretBytes());
            if (!signedJWT.verify(verifier)) {
                return Optional.empty();
            }

            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
            if (claims.getExpirationTime().before(new Date())) {
                return Optional.empty();
            }

            return Optional.of(claims);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    // --- JSON Utility ---
    public static String extractJsonField(String json, String field) {
        try {
            JsonNode node = MAPPER.readTree(json);
            JsonNode value = node.get(field);
            if (value == null || value.isNull()) {
                return null;
            }
            return value.asText();
        } catch (Exception e) {
            return null;
        }
    }

    // --- Utilities ---

    private byte[] getSecretBytes() {
        byte[] secret = jwtSecret.getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) {
            throw new IllegalStateException(
                    "JWT secret must be at least 32 bytes. Current length: " + secret.length);
        }
        return secret;
    }

    private String sha256Hash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    private void evictExpiredChallenges() {
        Instant now = Instant.now();
        challenges.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(now));
    }
}

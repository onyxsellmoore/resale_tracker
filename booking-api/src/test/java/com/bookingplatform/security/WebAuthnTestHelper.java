package com.bookingplatform.security;

import com.bookingplatform.model.User;
import com.bookingplatform.model.WebAuthnCredential;
import com.bookingplatform.repository.WebAuthnCredentialRepository;
import com.bookingplatform.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.cbor.CBORFactory;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECPoint;
import java.util.*;

/**
 * Test-only helper for creating WebAuthn credentials and assertions.
 * This class is ONLY in src/test and is never deployed to production.
 */
@ApplicationScoped
public class WebAuthnTestHelper {

    @Inject
    WebAuthnCredentialRepository credentialRepository;

    @ConfigProperty(name = "booking.webauthn.rp-id", defaultValue = "localhost")
    String rpId;

    @ConfigProperty(name = "booking.webauthn.origin", defaultValue = "http://localhost:8081")
    String origin;

    private final Map<String, KeyPair> keyPairs = new java.util.concurrent.ConcurrentHashMap<>();

    private static final ObjectMapper CBOR_MAPPER = new ObjectMapper(new CBORFactory());

    /**
     * Registers a test credential with a generated EC key pair.
     */
    public void registerTestCredential(User user) {
        try {
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
            kpg.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair keyPair = kpg.generateKeyPair();

            keyPairs.put(user.id.toHexString(), keyPair);

            String credId = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(UUID.randomUUID().toString().getBytes());

            WebAuthnCredential cred = new WebAuthnCredential();
            cred.ownerId = user.id.toHexString();
            cred.credentialId = credId;
            cred.publicKey = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(keyPair.getPublic().getEncoded());
            cred.signCount = 0;
            cred.createdAt = java.time.Instant.now();
            credentialRepository.persist(cred);

        } catch (Exception e) {
            throw new RuntimeException("Failed to register test credential", e);
        }
    }

    /**
     * Creates a valid WebAuthn assertion JSON for testing (login flow).
     */
    public String createTestAssertion(User user, String loginBeginResponse) {
        try {
            String challenge = AuthService.extractJsonField(loginBeginResponse, "challenge");

            KeyPair keyPair = keyPairs.get(user.id.toHexString());
            if (keyPair == null) {
                throw new RuntimeException("No test key pair found for user");
            }

            List<WebAuthnCredential> creds = credentialRepository.findByOwnerId(user.id.toHexString());
            String credentialId = creds.getFirst().credentialId;

            // Build clientDataJSON
            String clientDataJsonStr = """
                {"type":"webauthn.get","challenge":"%s","origin":"%s"}
                """.formatted(challenge, origin).strip();
            byte[] clientDataBytes = clientDataJsonStr.getBytes(StandardCharsets.UTF_8);
            String clientDataJSON = Base64.getUrlEncoder().withoutPadding().encodeToString(clientDataBytes);

            // Build authenticatorData: rpIdHash(32) + flags(1) + signCount(4)
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] rpIdHash = sha256.digest(rpId.getBytes(StandardCharsets.UTF_8));
            byte[] authData = new byte[37];
            System.arraycopy(rpIdHash, 0, authData, 0, 32);
            authData[32] = 0x01; // User present flag
            authData[33] = 0;    // signCount bytes (big endian)
            authData[34] = 0;
            authData[35] = 0;
            authData[36] = 1;    // signCount = 1
            String authenticatorData = Base64.getUrlEncoder().withoutPadding().encodeToString(authData);

            // Sign: authenticatorData + SHA-256(clientDataJSON)
            byte[] clientDataHash = sha256.digest(clientDataBytes);
            byte[] verificationData = new byte[authData.length + clientDataHash.length];
            System.arraycopy(authData, 0, verificationData, 0, authData.length);
            System.arraycopy(clientDataHash, 0, verificationData, authData.length, clientDataHash.length);

            Signature signer = Signature.getInstance("SHA256withECDSA");
            signer.initSign(keyPair.getPrivate());
            signer.update(verificationData);
            byte[] sig = signer.sign();
            String signature = Base64.getUrlEncoder().withoutPadding().encodeToString(sig);

            return """
                {
                    "email": "%s",
                    "credentialId": "%s",
                    "authenticatorData": "%s",
                    "clientDataJSON": "%s",
                    "signature": "%s"
                }
                """.formatted(user.email, credentialId, authenticatorData, clientDataJSON, signature);

        } catch (Exception e) {
            throw new RuntimeException("Failed to create test assertion", e);
        }
    }

    /**
     * Creates a valid WebAuthn attestation JSON for testing (registration flow).
     * Returns a JSON string with email, credentialId, attestationObject, clientDataJSON.
     */
    public String createTestAttestation(User user, String registerBeginResponse) {
        try {
            String challenge = AuthService.extractJsonField(registerBeginResponse, "challenge");

            // Generate a new key pair for this user
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
            kpg.initialize(new ECGenParameterSpec("secp256r1"));
            KeyPair keyPair = kpg.generateKeyPair();
            keyPairs.put(user.id.toHexString(), keyPair);

            // Generate credential ID
            byte[] credIdBytes = new byte[32];
            new SecureRandom().nextBytes(credIdBytes);
            String credentialId = Base64.getUrlEncoder().withoutPadding().encodeToString(credIdBytes);

            // Build clientDataJSON
            String clientDataJsonStr = """
                {"type":"webauthn.create","challenge":"%s","origin":"%s"}
                """.formatted(challenge, origin).strip();
            byte[] clientDataBytes = clientDataJsonStr.getBytes(StandardCharsets.UTF_8);
            String clientDataJSON = Base64.getUrlEncoder().withoutPadding().encodeToString(clientDataBytes);

            // Build authData for attestation:
            // rpIdHash(32) + flags(1) + signCount(4) + aaguid(16) + credIdLen(2) + credId + coseKey
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] rpIdHash = sha256.digest(rpId.getBytes(StandardCharsets.UTF_8));

            ByteArrayOutputStream authDataStream = new ByteArrayOutputStream();
            // rpIdHash (32 bytes)
            authDataStream.write(rpIdHash);
            // flags: UP (0x01) + AT (0x40) = 0x41
            authDataStream.write(0x41);
            // signCount (4 bytes, big-endian) = 0
            authDataStream.write(new byte[]{0, 0, 0, 0});
            // AAGUID (16 bytes of zeros)
            authDataStream.write(new byte[16]);
            // credIdLen (2 bytes, big-endian)
            authDataStream.write((credIdBytes.length >> 8) & 0xFF);
            authDataStream.write(credIdBytes.length & 0xFF);
            // credentialId bytes
            authDataStream.write(credIdBytes);
            // COSE key (EC2 P-256)
            ECPublicKey ecPub = (ECPublicKey) keyPair.getPublic();
            ECPoint point = ecPub.getW();
            byte[] x = toFixedLength(point.getAffineX().toByteArray(), 32);
            byte[] y = toFixedLength(point.getAffineY().toByteArray(), 32);

            // Build COSE key as CBOR map: {1:2, 3:-7, -1:1, -2:x, -3:y}
            Map<Integer, Object> coseKey = new LinkedHashMap<>();
            coseKey.put(1, 2);    // kty: EC
            coseKey.put(3, -7);   // alg: ES256
            coseKey.put(-1, 1);   // crv: P-256
            coseKey.put(-2, x);   // x coordinate
            coseKey.put(-3, y);   // y coordinate
            byte[] coseKeyBytes = CBOR_MAPPER.writeValueAsBytes(coseKey);
            authDataStream.write(coseKeyBytes);

            byte[] authData = authDataStream.toByteArray();

            // Build attestationObject as CBOR: {fmt: "none", attStmt: {}, authData: <bytes>}
            Map<String, Object> attestationObj = new LinkedHashMap<>();
            attestationObj.put("fmt", "none");
            attestationObj.put("attStmt", Map.of());
            attestationObj.put("authData", authData);
            byte[] attestationBytes = CBOR_MAPPER.writeValueAsBytes(attestationObj);
            String attestationObject = Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(attestationBytes);

            return """
                {
                    "email": "%s",
                    "credentialId": "%s",
                    "attestationObject": "%s",
                    "clientDataJSON": "%s"
                }
                """.formatted(user.email, credentialId, attestationObject, clientDataJSON);

        } catch (Exception e) {
            throw new RuntimeException("Failed to create test attestation", e);
        }
    }

    /** Ensures a BigInteger byte array is exactly the given length (handles sign byte padding). */
    private static byte[] toFixedLength(byte[] bytes, int length) {
        if (bytes.length == length) return bytes;
        byte[] result = new byte[length];
        if (bytes.length > length) {
            // Strip leading zero (sign byte)
            System.arraycopy(bytes, bytes.length - length, result, 0, length);
        } else {
            // Pad with leading zeros
            System.arraycopy(bytes, 0, result, length - bytes.length, bytes.length);
        }
        return result;
    }
}

package com.bookingplatform.resource;

import com.bookingplatform.model.RefreshToken;
import com.bookingplatform.model.Role;
import com.bookingplatform.model.User;
import com.bookingplatform.repository.RefreshTokenRepository;
import com.bookingplatform.repository.UserRepository;
import com.bookingplatform.repository.WebAuthnCredentialRepository;
import com.bookingplatform.security.SecurityEnabledProfile;
import com.bookingplatform.security.WebAuthnTestHelper;
import com.bookingplatform.service.AuthService;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.mongodb.MongoTestResource;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
@TestProfile(SecurityEnabledProfile.class)
@DisplayName("Auth API")
class AuthResourceTest {

    @Inject UserRepository userRepository;
    @Inject WebAuthnCredentialRepository credentialRepository;
    @Inject RefreshTokenRepository refreshTokenRepository;
    @Inject AuthService authService;
    @Inject WebAuthnTestHelper webAuthnTestHelper;

    private User testUser;

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        credentialRepository.deleteAll();
        userRepository.deleteAll();

        testUser = new User();
        testUser.orgId = new ObjectId();
        testUser.email = "owner@test.com";
        testUser.displayName = "Test Owner";
        testUser.role = Role.ADMIN;
        testUser.createdAt = Instant.now();
        userRepository.persist(testUser);

        webAuthnTestHelper.registerTestCredential(testUser);
    }

    @Nested @DisplayName("passkey login flow")
    class PasskeyLogin {

        @Test @DisplayName("valid assertion → 200 accessToken + refreshToken")
        void validLogin() {
            String challengeResponse = given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "owner@test.com"}
                        """)
                    .when()
                    .post("/api/v1/auth/login/begin")
                    .then()
                    .statusCode(200)
                    .body("challenge", notNullValue())
                    .extract().asString();

            String assertionJson = webAuthnTestHelper.createTestAssertion(testUser, challengeResponse);

            given()
                    .contentType(ContentType.JSON)
                    .body(assertionJson)
                    .when()
                    .post("/api/v1/auth/login/complete")
                    .then()
                    .statusCode(200)
                    .body("accessToken", notNullValue())
                    .body("refreshToken", notNullValue());
        }

        @Test @DisplayName("tampered signature → 401")
        void wrongCredential() {
            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "owner@test.com"}
                        """)
                    .when()
                    .post("/api/v1/auth/login/begin")
                    .then()
                    .statusCode(200);

            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {
                            "email": "owner@test.com",
                            "credentialId": "invalid",
                            "authenticatorData": "invalid",
                            "clientDataJSON": "invalid",
                            "signature": "invalid"
                        }
                        """)
                    .when()
                    .post("/api/v1/auth/login/complete")
                    .then()
                    .statusCode(401)
                    .body("message", equalTo("Authentication failed"));
        }

        @Test @DisplayName("unknown email → 401 identical response")
        void unknownEmail() {
            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "nobody@test.com"}
                        """)
                    .when()
                    .post("/api/v1/auth/login/begin")
                    .then()
                    .statusCode(401)
                    .body("message", equalTo("Authentication failed"));
        }
    }

    @Nested @DisplayName("passkey registration flow")
    class PasskeyRegistration {

        @Test @DisplayName("begin for existing user → 200 with challenge + rpId")
        void beginExistingUser() {
            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "owner@test.com"}
                        """)
                    .when()
                    .post("/api/v1/auth/register/begin")
                    .then()
                    .statusCode(200)
                    .body("challenge", notNullValue())
                    .body("rp.id", equalTo("localhost"))
                    .body("rp.name", equalTo("Inventory Ledger"))
                    .body("pubKeyCredParams[0].type", equalTo("public-key"))
                    .body("pubKeyCredParams[0].alg", equalTo(-7))
                    .body("user.name", equalTo("owner@test.com"))
                    .body("user.displayName", equalTo("Test Owner"));
        }

        @Test @DisplayName("begin for unknown email → 401")
        void beginUnknownEmail() {
            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "unknown@test.com"}
                        """)
                    .when()
                    .post("/api/v1/auth/register/begin")
                    .then()
                    .statusCode(401)
                    .body("message", equalTo("Authentication failed"));
        }

        @Test @DisplayName("complete with valid attestation → 200 accessToken + refreshToken")
        void completeValid() {
            User newUser = new User();
            newUser.orgId = new ObjectId();
            newUser.email = "new@test.com";
            newUser.displayName = "New User";
            newUser.role = Role.ADMIN;
            newUser.createdAt = Instant.now();
            userRepository.persist(newUser);

            String beginResponse = given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "new@test.com"}
                        """)
                    .when()
                    .post("/api/v1/auth/register/begin")
                    .then()
                    .statusCode(200)
                    .body("challenge", notNullValue())
                    .extract().asString();

            String attestationJson = webAuthnTestHelper.createTestAttestation(newUser, beginResponse);

            given()
                    .contentType(ContentType.JSON)
                    .body(attestationJson)
                    .when()
                    .post("/api/v1/auth/register/complete")
                    .then()
                    .statusCode(200)
                    .body("accessToken", notNullValue())
                    .body("refreshToken", notNullValue());
        }

        @Test @DisplayName("complete with replayed challenge → 401")
        void replayedChallenge() {
            User newUser = new User();
            newUser.orgId = new ObjectId();
            newUser.email = "replay@test.com";
            newUser.displayName = "Replay User";
            newUser.role = Role.ADMIN;
            newUser.createdAt = Instant.now();
            userRepository.persist(newUser);

            String beginResponse = given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "replay@test.com"}
                        """)
                    .when()
                    .post("/api/v1/auth/register/begin")
                    .then()
                    .statusCode(200)
                    .extract().asString();

            String attestationJson = webAuthnTestHelper.createTestAttestation(newUser, beginResponse);

            // First complete succeeds
            given()
                    .contentType(ContentType.JSON)
                    .body(attestationJson)
                    .when()
                    .post("/api/v1/auth/register/complete")
                    .then()
                    .statusCode(200);

            // Second complete with same challenge fails
            String attestationJson2 = webAuthnTestHelper.createTestAttestation(newUser, beginResponse);
            given()
                    .contentType(ContentType.JSON)
                    .body(attestationJson2)
                    .when()
                    .post("/api/v1/auth/register/complete")
                    .then()
                    .statusCode(401);
        }
    }

    @Nested @DisplayName("password login endpoint removed")
    class PasswordLoginGone {

        @Test @DisplayName("POST /api/v1/auth/login → 404")
        void passwordEndpointDoesNotExist() {
            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "a@b.com", "password": "secret"}
                        """)
                    .when()
                    .post("/api/v1/auth/login")
                    .then()
                    .statusCode(404);
        }
    }

    @Nested @DisplayName("no-passkey login begin")
    class NoPasskeyLoginBegin {

        @Test @DisplayName("login/begin for email with no passkey → 409 no_passkey")
        void noPasskeyReturns409() {
            User noPasskeyUser = new User();
            noPasskeyUser.orgId = new ObjectId();
            noPasskeyUser.email = "nopasskey@test.com";
            noPasskeyUser.displayName = "No Passkey";
            noPasskeyUser.role = Role.ADMIN;
            noPasskeyUser.createdAt = Instant.now();
            userRepository.persist(noPasskeyUser);

            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "nopasskey@test.com"}
                        """)
                    .when()
                    .post("/api/v1/auth/login/begin")
                    .then()
                    .statusCode(409)
                    .body("message", equalTo("no_passkey"));
        }

        @Test @DisplayName("login/begin for unknown email → 401")
        void unknownEmailStill401() {
            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "unknown@test.com"}
                        """)
                    .when()
                    .post("/api/v1/auth/login/begin")
                    .then()
                    .statusCode(401)
                    .body("message", equalTo("Authentication failed"));
        }
    }

    @Nested @DisplayName("password login")
    class PasswordLogin {

        @Test @DisplayName("correct password → 200 with accessToken")
        void correctPassword() {
            User pwUser = new User();
            pwUser.orgId = new ObjectId();
            pwUser.email = "pwuser@test.com";
            pwUser.displayName = "PW User";
            pwUser.role = Role.ADMIN;
            pwUser.createdAt = Instant.now();
            pwUser.temporaryPasswordSalt = "abcd1234";
            pwUser.temporaryPasswordHash = sha256Hex("abcd1234" + "secret123");
            userRepository.persist(pwUser);

            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "pwuser@test.com", "password": "secret123"}
                        """)
                    .when()
                    .post("/api/v1/auth/login/password")
                    .then()
                    .statusCode(200)
                    .body("accessToken", notNullValue())
                    .body("refreshToken", notNullValue());
        }

        @Test @DisplayName("wrong password → 401")
        void wrongPassword() {
            User pwUser = new User();
            pwUser.orgId = new ObjectId();
            pwUser.email = "pwwrong@test.com";
            pwUser.displayName = "PW Wrong";
            pwUser.role = Role.ADMIN;
            pwUser.createdAt = Instant.now();
            pwUser.temporaryPasswordSalt = "abcd1234";
            pwUser.temporaryPasswordHash = sha256Hex("abcd1234" + "secret123");
            userRepository.persist(pwUser);

            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "pwwrong@test.com", "password": "wrongpassword"}
                        """)
                    .when()
                    .post("/api/v1/auth/login/password")
                    .then()
                    .statusCode(401)
                    .body("message", equalTo("Invalid email or password"));
        }

        @Test @DisplayName("user with no temporaryPasswordHash → 401")
        void noPasswordHash() {
            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "owner@test.com", "password": "anything"}
                        """)
                    .when()
                    .post("/api/v1/auth/login/password")
                    .then()
                    .statusCode(401)
                    .body("message", equalTo("Invalid email or password"));
        }

        @Test @DisplayName("user created with password can login via password endpoint")
        void createUserWithPasswordThenLogin() {
            String jwt = authService.generateUserJwt(testUser);

            given()
                    .contentType(ContentType.JSON)
                    .header("Authorization", "Bearer " + jwt)
                    .body("""
                        {"email": "newpw@test.com", "displayName": "New PW User", "role": "BUYER", "password": "temppass"}
                        """)
                    .when()
                    .post("/api/v1/users")
                    .then()
                    .statusCode(201);

            User created = userRepository.findByEmail("newpw@test.com").orElseThrow();
            org.junit.jupiter.api.Assertions.assertNotNull(created.temporaryPasswordHash);
            org.junit.jupiter.api.Assertions.assertNotNull(created.temporaryPasswordSalt);

            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"email": "newpw@test.com", "password": "temppass"}
                        """)
                    .when()
                    .post("/api/v1/auth/login/password")
                    .then()
                    .statusCode(200)
                    .body("accessToken", notNullValue());
        }
    }

    @Nested @DisplayName("token lifecycle")
    class TokenLifecycle {

        @Test @DisplayName("refresh with valid token → new accessToken")
        void refreshValid() {
            AuthService.TokenPair tokens = authService.generateTokens(testUser);

            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"refreshToken": "%s"}
                        """.formatted(tokens.refreshToken()))
                    .when()
                    .post("/api/v1/auth/refresh")
                    .then()
                    .statusCode(200)
                    .body("accessToken", notNullValue());
        }

        @Test @DisplayName("refresh with expired token → 401")
        void refreshExpired() {
            AuthService.TokenPair tokens = authService.generateTokens(testUser);
            RefreshToken rt = refreshTokenRepository.listAll().getFirst();
            rt.expiresAt = Instant.now().minus(1, ChronoUnit.HOURS);
            refreshTokenRepository.update(rt);

            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"refreshToken": "%s"}
                        """.formatted(tokens.refreshToken()))
                    .when()
                    .post("/api/v1/auth/refresh")
                    .then()
                    .statusCode(401);
        }

        @Test @DisplayName("logout then refresh → 401")
        void logoutThenRefresh() {
            AuthService.TokenPair tokens = authService.generateTokens(testUser);

            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"refreshToken": "%s"}
                        """.formatted(tokens.refreshToken()))
                    .when()
                    .post("/api/v1/auth/logout")
                    .then()
                    .statusCode(204);

            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"refreshToken": "%s"}
                        """.formatted(tokens.refreshToken()))
                    .when()
                    .post("/api/v1/auth/refresh")
                    .then()
                    .statusCode(401);
        }

        @Test @DisplayName("logout with no token → 204 (idempotent)")
        void logoutNoToken() {
            given()
                    .contentType(ContentType.JSON)
                    .body("""
                        {"refreshToken": "nonexistent-token"}
                        """)
                    .when()
                    .post("/api/v1/auth/logout")
                    .then()
                    .statusCode(204);
        }
    }
}

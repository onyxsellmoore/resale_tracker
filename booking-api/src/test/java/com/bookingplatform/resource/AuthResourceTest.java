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

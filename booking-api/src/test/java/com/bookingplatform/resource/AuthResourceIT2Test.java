package com.bookingplatform.resource;

import com.bookingplatform.repository.OrganizationRepository;
import com.bookingplatform.repository.UserRepository;
import com.bookingplatform.repository.WebAuthnCredentialRepository;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.mongodb.MongoTestResource;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
@DisplayName("Auth API — organisation registration")
class AuthResourceIT2Test {

    @Inject OrganizationRepository organizationRepository;
    @Inject UserRepository userRepository;
    @Inject WebAuthnCredentialRepository credentialRepository;

    @BeforeEach
    void setUp() {
        credentialRepository.deleteAll();
        userRepository.deleteAll();
        organizationRepository.deleteAll();
    }

    @Nested @DisplayName("POST /register")
    class Register {

        @Test @DisplayName("valid request → 201 with orgId + userId + role")
        void validRequest() {
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "orgName": "Vintage Co",
                        "orgSlug": "vintage-co",
                        "adminEmail": "admin@vintage.co",
                        "adminDisplayName": "Admin User"
                    }
                    """)
            .when()
                .post("/api/v1/auth/register")
            .then()
                .statusCode(201)
                .body("orgId", notNullValue())
                .body("userId", notNullValue())
                .body("role", equalTo("ADMIN"))
                .body("$", not(hasKey("token")));
        }

        @Test @DisplayName("duplicate slug → 409")
        void duplicateSlug() {
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "orgName": "First Org",
                        "orgSlug": "duplicate-slug",
                        "adminEmail": "admin1@test.com",
                        "adminDisplayName": "Admin One"
                    }
                    """)
            .when()
                .post("/api/v1/auth/register")
            .then()
                .statusCode(201);

            given()
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "orgName": "Second Org",
                        "orgSlug": "duplicate-slug",
                        "adminEmail": "admin2@test.com",
                        "adminDisplayName": "Admin Two"
                    }
                    """)
            .when()
                .post("/api/v1/auth/register")
            .then()
                .statusCode(409);
        }

        @Test @DisplayName("response contains no password or token")
        void noPasswordOrToken() {
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "orgName": "Test Org",
                        "orgSlug": "no-token-test",
                        "adminEmail": "admin@notoken.com",
                        "adminDisplayName": "Admin"
                    }
                    """)
            .when()
                .post("/api/v1/auth/register")
            .then()
                .statusCode(201)
                .body("$", not(hasKey("token")))
                .body("$", not(hasKey("password")))
                .body("$", not(hasKey("passwordHash")));
        }
    }

    @Nested @DisplayName("POST /dev-token")
    class DevToken {

        @Test @DisplayName("returns JWT for existing user when enabled")
        void returnsJwtForExistingUser() {
            // Register an org first
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "orgName": "Dev Token Org",
                        "orgSlug": "dev-token-test",
                        "adminEmail": "admin@devtoken.com",
                        "adminDisplayName": "Admin"
                    }
                    """)
            .when()
                .post("/api/v1/auth/register")
            .then()
                .statusCode(201);

            // Get dev token
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {"email": "admin@devtoken.com"}
                    """)
            .when()
                .post("/api/v1/auth/dev-token")
            .then()
                .statusCode(200)
                .body("accessToken", notNullValue());
        }

        @Test @DisplayName("unknown email → 404")
        void unknownEmail() {
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {"email": "nobody@test.com"}
                    """)
            .when()
                .post("/api/v1/auth/dev-token")
            .then()
                .statusCode(404);
        }
    }

    @Nested @DisplayName("password login endpoint removed")
    class PasswordLoginGone {

        @Test @DisplayName("POST /api/v1/auth/login → 404")
        void passwordEndpointDoesNotExist() {
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "email": "test@test.com",
                        "password": "whatever"
                    }
                    """)
            .when()
                .post("/api/v1/auth/login")
            .then()
                .statusCode(404);
        }
    }
}

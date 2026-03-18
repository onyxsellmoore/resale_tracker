package com.bookingplatform.resource;

import com.bookingplatform.model.User;
import com.bookingplatform.repository.OrganizationRepository;
import com.bookingplatform.repository.UserRepository;
import com.bookingplatform.security.SecurityEnabledProfile;
import com.bookingplatform.service.AuthService;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
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
@TestProfile(SecurityEnabledProfile.class)
@DisplayName("User API")
class UserResourceIT2Test {

    @Inject OrganizationRepository organizationRepository;
    @Inject UserRepository userRepository;
    @Inject AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        organizationRepository.deleteAll();
    }

    private String registerAndGetToken(String orgSlug, String email) {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "orgName": "Test Org %s",
                    "orgSlug": "%s",
                    "adminEmail": "%s",
                    "adminDisplayName": "Admin"
                }
                """.formatted(orgSlug, orgSlug, email))
        .when()
            .post("/api/v1/auth/register")
        .then()
            .statusCode(201);

        User user = userRepository.findByEmail(email).orElseThrow();
        return authService.generateUserJwt(user);
    }

    @Nested @DisplayName("POST /users")
    class CreateUser {

        @Test @DisplayName("ADMIN can create new user → 201")
        void adminCanCreate() {
            String adminToken = registerAndGetToken("test-org", "admin@test.com");

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "email": "buyer@test.com",
                        "displayName": "Buyer User",
                        "role": "BUYER"
                    }
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("email", equalTo("buyer@test.com"))
                .body("displayName", equalTo("Buyer User"))
                .body("role", equalTo("BUYER"))
                .body("orgId", notNullValue());
        }

        @Test @DisplayName("non-ADMIN cannot create user → 403")
        void nonAdminBlocked() {
            String adminToken = registerAndGetToken("test-org2", "admin2@test.com");

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "email": "buyer2@test.com",
                        "displayName": "Buyer",
                        "role": "BUYER"
                    }
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(201);

            User buyer = userRepository.findByEmail("buyer2@test.com").orElseThrow();
            String buyerToken = authService.generateUserJwt(buyer);

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + buyerToken)
                .body("""
                    {
                        "email": "another@test.com",
                        "displayName": "Another",
                        "role": "SELLER"
                    }
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(403);
        }
    }

    @Nested @DisplayName("GET /users")
    class ListUsers {

        @Test @DisplayName("ADMIN can list users in org")
        void adminCanList() {
            String adminToken = registerAndGetToken("test-org3", "admin3@test.com");

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "email": "seller@test.com",
                        "displayName": "Seller User",
                        "role": "SELLER"
                    }
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(201);

            given()
                .header("Authorization", "Bearer " + adminToken)
            .when()
                .get("/api/v1/users")
            .then()
                .statusCode(200)
                .body("size()", equalTo(2))
                .body("email", hasItems("admin3@test.com", "seller@test.com"));
        }

        @Test @DisplayName("non-ADMIN cannot list users → 403")
        void nonAdminBlocked() {
            String adminToken = registerAndGetToken("test-org4", "admin4@test.com");

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "email": "buyer4@test.com",
                        "displayName": "Buyer",
                        "role": "BUYER"
                    }
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(201);

            User buyer = userRepository.findByEmail("buyer4@test.com").orElseThrow();
            String buyerToken = authService.generateUserJwt(buyer);

            given()
                .header("Authorization", "Bearer " + buyerToken)
            .when()
                .get("/api/v1/users")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("cannot list users from another org")
        void crossOrgBlocked() {
            String adminTokenA = registerAndGetToken("org-a", "adminA@test.com");
            String adminTokenB = registerAndGetToken("org-b", "adminB@test.com");

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminTokenB)
                .body("""
                    {
                        "email": "orgb-user@test.com",
                        "displayName": "Org B User",
                        "role": "SELLER"
                    }
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(201);

            given()
                .header("Authorization", "Bearer " + adminTokenA)
            .when()
                .get("/api/v1/users")
            .then()
                .statusCode(200)
                .body("size()", equalTo(1))
                .body("[0].email", equalTo("adminA@test.com"));
        }
    }

    @Nested @DisplayName("no token → 401")
    class Unauthenticated {

        @Test @DisplayName("POST /users → 401")
        void postNoToken() {
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {"email": "x@test.com", "displayName": "X", "role": "BUYER"}
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(401);
        }

        @Test @DisplayName("GET /users → 401")
        void getNoToken() {
            given()
            .when()
                .get("/api/v1/users")
            .then()
                .statusCode(401);
        }
    }
}

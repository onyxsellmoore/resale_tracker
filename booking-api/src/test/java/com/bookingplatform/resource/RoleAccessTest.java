package com.bookingplatform.resource;

import com.bookingplatform.model.User;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.OrganizationRepository;
import com.bookingplatform.repository.SaleRepository;
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
@DisplayName("Role-based access control")
class RoleAccessTest {

    @Inject OrganizationRepository organizationRepository;
    @Inject UserRepository userRepository;
    @Inject ItemRepository itemRepository;
    @Inject SaleRepository saleRepository;
    @Inject AuthService authService;

    private String adminToken;
    private String buyerToken;
    private String sellerToken;
    private String accountantToken;

    @BeforeEach
    void setUp() {
        saleRepository.deleteAll();
        itemRepository.deleteAll();
        userRepository.deleteAll();
        organizationRepository.deleteAll();

        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "orgName": "Role Test Org",
                    "orgSlug": "role-test",
                    "adminEmail": "admin@role.com",
                    "adminDisplayName": "Admin"
                }
                """)
        .when()
            .post("/api/v1/auth/register")
        .then()
            .statusCode(201);

        User admin = userRepository.findByEmail("admin@role.com").orElseThrow();
        adminToken = authService.generateUserJwt(admin);

        buyerToken = createUserAndGetToken("buyer@role.com", "BUYER");
        sellerToken = createUserAndGetToken("seller@role.com", "SELLER");
        accountantToken = createUserAndGetToken("accountant@role.com", "ACCOUNTANT");
    }

    private String createUserAndGetToken(String email, String role) {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body("""
                {
                    "email": "%s",
                    "displayName": "%s User",
                    "role": "%s"
                }
                """.formatted(email, role, role))
        .when()
            .post("/api/v1/users")
        .then()
            .statusCode(201);

        User user = userRepository.findByEmail(email).orElseThrow();
        return authService.generateUserJwt(user);
    }

    @Nested @DisplayName("POST /items — ADMIN and BUYER only")
    class ItemPost {

        @Test @DisplayName("ADMIN can create item → 201")
        void adminCanPost() {
            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {"name": "Test", "condition": "GOOD", "purchasePrice": 10.00, "purchaseDate": "2025-01-15T00:00:00Z"}
                    """)
            .when()
                .post("/api/v1/items")
            .then()
                .statusCode(201);
        }

        @Test @DisplayName("BUYER can create item → 201")
        void buyerCanPost() {
            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + buyerToken)
                .body("""
                    {"name": "Test", "condition": "GOOD", "purchasePrice": 10.00, "purchaseDate": "2025-01-15T00:00:00Z"}
                    """)
            .when()
                .post("/api/v1/items")
            .then()
                .statusCode(201);
        }

        @Test @DisplayName("SELLER cannot create item → 403")
        void sellerBlocked() {
            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + sellerToken)
                .body("""
                    {"name": "Test", "condition": "GOOD", "purchasePrice": 10.00, "purchaseDate": "2025-01-15T00:00:00Z"}
                    """)
            .when()
                .post("/api/v1/items")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("ACCOUNTANT cannot create item → 403")
        void accountantBlocked() {
            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + accountantToken)
                .body("""
                    {"name": "Test", "condition": "GOOD", "purchasePrice": 10.00, "purchaseDate": "2025-01-15T00:00:00Z"}
                    """)
            .when()
                .post("/api/v1/items")
            .then()
                .statusCode(403);
        }
    }

    @Nested @DisplayName("GET /items — all roles allowed")
    class ItemGet {

        @Test @DisplayName("ADMIN can list items → 200")
        void adminCanList() {
            given()
                .header("Authorization", "Bearer " + adminToken)
            .when()
                .get("/api/v1/items")
            .then()
                .statusCode(200);
        }

        @Test @DisplayName("BUYER can list items → 200")
        void buyerCanList() {
            given()
                .header("Authorization", "Bearer " + buyerToken)
            .when()
                .get("/api/v1/items")
            .then()
                .statusCode(200);
        }

        @Test @DisplayName("SELLER can list items → 200")
        void sellerCanList() {
            given()
                .header("Authorization", "Bearer " + sellerToken)
            .when()
                .get("/api/v1/items")
            .then()
                .statusCode(200);
        }

        @Test @DisplayName("ACCOUNTANT can list items → 200")
        void accountantCanList() {
            given()
                .header("Authorization", "Bearer " + accountantToken)
            .when()
                .get("/api/v1/items")
            .then()
                .statusCode(200);
        }
    }

    @Nested @DisplayName("PATCH /items/:id — all roles allowed")
    class ItemPatch {

        @Test @DisplayName("BUYER can update item → 200")
        void buyerCanPatch() {
            String itemId = createTestItem();

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + buyerToken)
                .body("{\"name\": \"Updated\"}")
            .when()
                .patch("/api/v1/items/{id}", itemId)
            .then()
                .statusCode(200)
                .body("name", equalTo("Updated"));
        }

        @Test @DisplayName("SELLER can update item → 200")
        void sellerCanPatch() {
            String itemId = createTestItem();

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + sellerToken)
                .body("{\"name\": \"Updated\"}")
            .when()
                .patch("/api/v1/items/{id}", itemId)
            .then()
                .statusCode(200);
        }

        @Test @DisplayName("ACCOUNTANT can update item → 200")
        void accountantCanPatch() {
            String itemId = createTestItem();

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + accountantToken)
                .body("{\"name\": \"Updated\"}")
            .when()
                .patch("/api/v1/items/{id}", itemId)
            .then()
                .statusCode(200);
        }
    }

    @Nested @DisplayName("DELETE /items/:id — ADMIN only")
    class ItemDelete {

        @Test @DisplayName("ADMIN can delete item → 204")
        void adminCanDelete() {
            String itemId = createTestItem();

            given()
                .header("Authorization", "Bearer " + adminToken)
            .when()
                .delete("/api/v1/items/{id}", itemId)
            .then()
                .statusCode(204);
        }

        @Test @DisplayName("BUYER cannot delete item → 403")
        void buyerBlocked() {
            String itemId = createTestItem();

            given()
                .header("Authorization", "Bearer " + buyerToken)
            .when()
                .delete("/api/v1/items/{id}", itemId)
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("SELLER cannot delete item → 403")
        void sellerBlocked() {
            String itemId = createTestItem();

            given()
                .header("Authorization", "Bearer " + sellerToken)
            .when()
                .delete("/api/v1/items/{id}", itemId)
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("ACCOUNTANT cannot delete item → 403")
        void accountantBlocked() {
            String itemId = createTestItem();

            given()
                .header("Authorization", "Bearer " + accountantToken)
            .when()
                .delete("/api/v1/items/{id}", itemId)
            .then()
                .statusCode(403);
        }
    }

    @Nested @DisplayName("POST /sales — ADMIN and SELLER only")
    class SalePost {

        @Test @DisplayName("ADMIN can create sale → 201")
        void adminCanPost() {
            String itemId = createTestItem();

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {"itemId": "%s", "platform": "Poshmark", "salePrice": 200, "platformFees": 40, "soldAt": "2025-06-01T12:00:00Z"}
                    """.formatted(itemId))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(201);
        }

        @Test @DisplayName("SELLER can create sale → 201")
        void sellerCanPost() {
            String itemId = createTestItem();

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + sellerToken)
                .body("""
                    {"itemId": "%s", "platform": "Poshmark", "salePrice": 200, "platformFees": 40, "soldAt": "2025-06-01T12:00:00Z"}
                    """.formatted(itemId))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(201);
        }

        @Test @DisplayName("BUYER cannot create sale → 403")
        void buyerBlocked() {
            String itemId = createTestItem();

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + buyerToken)
                .body("""
                    {"itemId": "%s", "platform": "Poshmark", "salePrice": 200, "platformFees": 40, "soldAt": "2025-06-01T12:00:00Z"}
                    """.formatted(itemId))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("ACCOUNTANT cannot create sale → 403")
        void accountantBlocked() {
            String itemId = createTestItem();

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + accountantToken)
                .body("""
                    {"itemId": "%s", "platform": "Poshmark", "salePrice": 200, "platformFees": 40, "soldAt": "2025-06-01T12:00:00Z"}
                    """.formatted(itemId))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(403);
        }
    }

    @Nested @DisplayName("GET /sales — all roles allowed")
    class SaleGet {

        @Test @DisplayName("ADMIN can list sales → 200")
        void adminCanList() {
            given()
                .header("Authorization", "Bearer " + adminToken)
            .when()
                .get("/api/v1/sales")
            .then()
                .statusCode(200);
        }

        @Test @DisplayName("BUYER can list sales → 200")
        void buyerCanList() {
            given()
                .header("Authorization", "Bearer " + buyerToken)
            .when()
                .get("/api/v1/sales")
            .then()
                .statusCode(200);
        }

        @Test @DisplayName("SELLER can list sales → 200")
        void sellerCanList() {
            given()
                .header("Authorization", "Bearer " + sellerToken)
            .when()
                .get("/api/v1/sales")
            .then()
                .statusCode(200);
        }

        @Test @DisplayName("ACCOUNTANT can list sales → 200")
        void accountantCanList() {
            given()
                .header("Authorization", "Bearer " + accountantToken)
            .when()
                .get("/api/v1/sales")
            .then()
                .statusCode(200);
        }
    }

    @Nested @DisplayName("GET /analytics — ADMIN and ACCOUNTANT only")
    class Analytics {

        @Test @DisplayName("ADMIN can view analytics → 200")
        void adminCanView() {
            given()
                .header("Authorization", "Bearer " + adminToken)
                .queryParam("from", "2025-01-01")
                .queryParam("to", "2025-12-31")
            .when()
                .get("/api/v1/analytics")
            .then()
                .statusCode(200);
        }

        @Test @DisplayName("ACCOUNTANT can view analytics → 200")
        void accountantCanView() {
            given()
                .header("Authorization", "Bearer " + accountantToken)
                .queryParam("from", "2025-01-01")
                .queryParam("to", "2025-12-31")
            .when()
                .get("/api/v1/analytics")
            .then()
                .statusCode(200);
        }

        @Test @DisplayName("BUYER cannot view analytics → 403")
        void buyerBlocked() {
            given()
                .header("Authorization", "Bearer " + buyerToken)
                .queryParam("from", "2025-01-01")
                .queryParam("to", "2025-12-31")
            .when()
                .get("/api/v1/analytics")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("SELLER cannot view analytics → 403")
        void sellerBlocked() {
            given()
                .header("Authorization", "Bearer " + sellerToken)
                .queryParam("from", "2025-01-01")
                .queryParam("to", "2025-12-31")
            .when()
                .get("/api/v1/analytics")
            .then()
                .statusCode(403);
        }
    }

    @Nested @DisplayName("POST /users — ADMIN only")
    class UserPost {

        @Test @DisplayName("BUYER cannot create user → 403")
        void buyerBlocked() {
            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + buyerToken)
                .body("""
                    {"email": "new@role.com", "displayName": "New", "role": "SELLER"}
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("SELLER cannot create user → 403")
        void sellerBlocked() {
            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + sellerToken)
                .body("""
                    {"email": "new@role.com", "displayName": "New", "role": "SELLER"}
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("ACCOUNTANT cannot create user → 403")
        void accountantBlocked() {
            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + accountantToken)
                .body("""
                    {"email": "new@role.com", "displayName": "New", "role": "SELLER"}
                    """)
            .when()
                .post("/api/v1/users")
            .then()
                .statusCode(403);
        }
    }

    @Nested @DisplayName("GET /users — ADMIN only")
    class UserGet {

        @Test @DisplayName("BUYER cannot list users → 403")
        void buyerBlocked() {
            given()
                .header("Authorization", "Bearer " + buyerToken)
            .when()
                .get("/api/v1/users")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("SELLER cannot list users → 403")
        void sellerBlocked() {
            given()
                .header("Authorization", "Bearer " + sellerToken)
            .when()
                .get("/api/v1/users")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("ACCOUNTANT cannot list users → 403")
        void accountantBlocked() {
            given()
                .header("Authorization", "Bearer " + accountantToken)
            .when()
                .get("/api/v1/users")
            .then()
                .statusCode(403);
        }
    }

    private String createTestItem() {
        return given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body("""
                {"name": "Test Item", "condition": "GOOD", "purchasePrice": 50.00, "purchaseDate": "2025-01-15T00:00:00Z"}
                """)
        .when()
            .post("/api/v1/items")
        .then()
            .statusCode(201)
            .extract().jsonPath().getString("id");
    }
}

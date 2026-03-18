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
@DisplayName("Analytics API")
class AnalyticsResourceTest {

    @Inject OrganizationRepository organizationRepository;
    @Inject UserRepository userRepository;
    @Inject ItemRepository itemRepository;
    @Inject SaleRepository saleRepository;
    @Inject AuthService authService;

    private String adminToken;
    private String accountantToken;
    private String buyerToken;
    private String sellerToken;

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
                    "orgName": "Analytics Test Org",
                    "orgSlug": "analytics-test",
                    "adminEmail": "admin@analytics-test.com",
                    "adminDisplayName": "Admin"
                }
                """)
        .when()
            .post("/api/v1/auth/register")
        .then()
            .statusCode(201);

        User admin = userRepository.findByEmail("admin@analytics-test.com").orElseThrow();
        adminToken = authService.generateUserJwt(admin);

        accountantToken = createUserAndGetToken("accountant@analytics-test.com", "ACCOUNTANT");
        buyerToken = createUserAndGetToken("buyer@analytics-test.com", "BUYER");
        sellerToken = createUserAndGetToken("seller@analytics-test.com", "SELLER");
    }

    private String createUserAndGetToken(String email, String role) {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body("""
                {"email": "%s", "displayName": "%s User", "role": "%s"}
                """.formatted(email, role, role))
        .when()
            .post("/api/v1/users")
        .then()
            .statusCode(201);

        User user = userRepository.findByEmail(email).orElseThrow();
        return authService.generateUserJwt(user);
    }

    @Nested @DisplayName("GET /analytics")
    class GetAnalytics {

        @Test @DisplayName("ADMIN with valid range → 200 with summary")
        void adminValidRange() {
            // Create an item and sale for non-empty analytics
            String itemId = given()
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

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {"itemId": "%s", "platform": "Poshmark", "salePrice": 200, "platformFees": 40, "soldAt": "2025-06-15T12:00:00Z"}
                    """.formatted(itemId))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(201);

            given()
                .header("Authorization", "Bearer " + adminToken)
                .queryParam("from", "2025-01-01")
                .queryParam("to", "2025-12-31")
            .when()
                .get("/api/v1/analytics")
            .then()
                .statusCode(200)
                .body("summary.itemsSold", equalTo(1))
                .body("summary.totalRevenue", anyOf(equalTo(200), equalTo(200.0f)))
                .body("summary.totalFees", anyOf(equalTo(40), equalTo(40.0f)))
                .body("summary.totalNetProceeds", anyOf(equalTo(160), equalTo(160.0f)))
                .body("summary.totalProfit", anyOf(equalTo(110), equalTo(110.0f)));
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
                .statusCode(200)
                .body("summary", notNullValue());
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

        @Test @DisplayName("no token → 401")
        void unauthenticated() {
            given()
                .queryParam("from", "2025-01-01")
                .queryParam("to", "2025-12-31")
            .when()
                .get("/api/v1/analytics")
            .then()
                .statusCode(401);
        }
    }
}

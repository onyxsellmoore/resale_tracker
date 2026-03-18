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
@DisplayName("Cross-org isolation")
class CrossOrgIsolationTest {

    @Inject OrganizationRepository organizationRepository;
    @Inject UserRepository userRepository;
    @Inject ItemRepository itemRepository;
    @Inject SaleRepository saleRepository;
    @Inject AuthService authService;

    @BeforeEach
    void setUp() {
        saleRepository.deleteAll();
        itemRepository.deleteAll();
        userRepository.deleteAll();
        organizationRepository.deleteAll();
    }

    private record OrgSetup(String token, String orgId) {}

    private OrgSetup registerOrg(String slug, String email) {
        var response = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "orgName": "Org %s",
                    "orgSlug": "%s",
                    "adminEmail": "%s",
                    "adminDisplayName": "Admin"
                }
                """.formatted(slug, slug, email))
        .when()
            .post("/api/v1/auth/register")
        .then()
            .statusCode(201)
            .extract().jsonPath();

        String orgId = response.getString("orgId");
        User user = userRepository.findByEmail(email).orElseThrow();
        String token = authService.generateUserJwt(user);

        return new OrgSetup(token, orgId);
    }

    @Nested @DisplayName("items are org-scoped")
    class ItemIsolation {

        @Test @DisplayName("org A cannot read org B items")
        void cannotReadOtherOrgItems() {
            OrgSetup orgA = registerOrg("org-a", "adminA@test.com");
            OrgSetup orgB = registerOrg("org-b", "adminB@test.com");

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + orgA.token())
                .body("""
                    {
                        "name": "Org A Item",
                        "brand": "BrandA",
                        "condition": "EXCELLENT",
                        "purchasePrice": 100.00,
                        "purchaseDate": "2025-01-15T00:00:00Z"
                    }
                    """)
            .when()
                .post("/api/v1/items")
            .then()
                .statusCode(201);

            given()
                .header("Authorization", "Bearer " + orgB.token())
            .when()
                .get("/api/v1/items")
            .then()
                .statusCode(200)
                .body("size()", equalTo(0));

            given()
                .header("Authorization", "Bearer " + orgA.token())
            .when()
                .get("/api/v1/items")
            .then()
                .statusCode(200)
                .body("size()", equalTo(1))
                .body("[0].name", equalTo("Org A Item"));
        }

        @Test @DisplayName("org A cannot update org B item → 404")
        void cannotPatchOtherOrgItem() {
            OrgSetup orgA = registerOrg("org-e", "adminE@test.com");
            OrgSetup orgB = registerOrg("org-f", "adminF@test.com");

            String itemId = given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + orgA.token())
                .body("""
                    {
                        "name": "Org A Item",
                        "condition": "GOOD",
                        "purchasePrice": 100.00,
                        "purchaseDate": "2025-01-15T00:00:00Z"
                    }
                    """)
            .when()
                .post("/api/v1/items")
            .then()
                .statusCode(201)
                .extract().jsonPath().getString("id");

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + orgB.token())
                .body("{\"name\": \"Hacked Name\"}")
            .when()
                .patch("/api/v1/items/{id}", itemId)
            .then()
                .statusCode(404);
        }
    }

    @Nested @DisplayName("sales are org-scoped")
    class SaleIsolation {

        @Test @DisplayName("org A cannot read org B sales")
        void cannotReadOtherOrgSales() {
            OrgSetup orgA = registerOrg("org-c", "adminC@test.com");
            OrgSetup orgB = registerOrg("org-d", "adminD@test.com");

            String itemId = given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + orgA.token())
                .body("""
                    {
                        "name": "Org A Sale Item",
                        "brand": "BrandA",
                        "condition": "GOOD",
                        "purchasePrice": 50.00,
                        "purchaseDate": "2025-01-15T00:00:00Z"
                    }
                    """)
            .when()
                .post("/api/v1/items")
            .then()
                .statusCode(201)
                .extract().jsonPath().getString("id");

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + orgA.token())
                .body("""
                    {
                        "itemId": "%s",
                        "platform": "Poshmark",
                        "salePrice": 200.00,
                        "platformFees": 40.00,
                        "soldAt": "2025-06-01T12:00:00Z"
                    }
                    """.formatted(itemId))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(201);

            given()
                .header("Authorization", "Bearer " + orgB.token())
            .when()
                .get("/api/v1/sales")
            .then()
                .statusCode(200)
                .body("size()", equalTo(0));
        }
    }
}

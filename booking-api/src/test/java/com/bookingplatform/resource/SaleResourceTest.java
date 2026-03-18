package com.bookingplatform.resource;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemCondition;
import com.bookingplatform.model.ItemStatus;
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
import org.bson.types.Decimal128;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
@TestProfile(SecurityEnabledProfile.class)
@DisplayName("Sale API")
class SaleResourceTest {

    @Inject ItemRepository itemRepository;
    @Inject SaleRepository saleRepository;
    @Inject OrganizationRepository organizationRepository;
    @Inject UserRepository userRepository;
    @Inject AuthService authService;

    private String adminToken;
    private String orgId;

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
                    "orgName": "Sale Test Org",
                    "orgSlug": "sale-test",
                    "adminEmail": "admin@sale-test.com",
                    "adminDisplayName": "Admin"
                }
                """)
        .when()
            .post("/api/v1/auth/register")
        .then()
            .statusCode(201);

        User admin = userRepository.findByEmail("admin@sale-test.com").orElseThrow();
        adminToken = authService.generateUserJwt(admin);
        orgId = admin.orgId.toHexString();
    }

    @Nested @DisplayName("POST /sales")
    class Create {

        @Test @DisplayName("valid sale → 201, item becomes SOLD")
        void validSale() {
            Item item = createTestItem(orgId, "Gucci Bag", new BigDecimal("250.00"));

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "itemId": "%s",
                        "platform": "Poshmark",
                        "salePrice": 400.00,
                        "platformFees": 80.00,
                        "soldAt": "2025-06-01T12:00:00Z",
                        "notes": "Quick sale"
                    }
                    """.formatted(item.id.toHexString()))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("platform", equalTo("Poshmark"))
                .body("itemName", equalTo("Gucci Bag"));

            Item updated = itemRepository.findById(item.id);
            assertEquals(ItemStatus.SOLD, updated.status);
        }

        @Test @DisplayName("item already SOLD → 409")
        void itemAlreadySold() {
            Item item = createTestItem(orgId, "Sold Item", new BigDecimal("100.00"));
            item.status = ItemStatus.SOLD;
            itemRepository.update(item);

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "itemId": "%s",
                        "platform": "Poshmark",
                        "salePrice": 200.00,
                        "platformFees": 40.00,
                        "soldAt": "2025-06-01T12:00:00Z"
                    }
                    """.formatted(item.id.toHexString()))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(409);
        }

        @Test @DisplayName("item not found → 404")
        void itemNotFound() {
            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "itemId": "aaaaaaaaaaaaaaaaaaaaaaaa",
                        "platform": "Poshmark",
                        "salePrice": 200.00,
                        "platformFees": 40.00,
                        "soldAt": "2025-06-01T12:00:00Z"
                    }
                    """)
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(404);
        }

        @Test @DisplayName("item from different org → 404")
        void itemWrongBusiness() {
            Item item = createTestItem("other-biz", "Other Biz Item", new BigDecimal("100.00"));

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "itemId": "%s",
                        "platform": "Poshmark",
                        "salePrice": 200.00,
                        "platformFees": 40.00,
                        "soldAt": "2025-06-01T12:00:00Z"
                    }
                    """.formatted(item.id.toHexString()))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(404);
        }

        @Test @DisplayName("salePrice = 0 → 400")
        void salePriceZero() {
            Item item = createTestItem(orgId, "Item", new BigDecimal("50.00"));

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "itemId": "%s",
                        "platform": "Poshmark",
                        "salePrice": 0,
                        "platformFees": 0,
                        "soldAt": "2025-06-01T12:00:00Z"
                    }
                    """.formatted(item.id.toHexString()))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(400);
        }
    }

    @Nested @DisplayName("fee validation")
    class FeeValidation {

        @Test @DisplayName("platformFees > salePrice → 400")
        void feesExceedSalePrice() {
            Item item = createTestItem(orgId, "Item", new BigDecimal("50.00"));

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "itemId": "%s",
                        "platform": "Poshmark",
                        "salePrice": 100.00,
                        "platformFees": 150.00,
                        "soldAt": "2025-06-01T12:00:00Z"
                    }
                    """.formatted(item.id.toHexString()))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(400);
        }

        @Test @DisplayName("negative salePrice → 400")
        void negativeSalePrice() {
            Item item = createTestItem(orgId, "Item", new BigDecimal("50.00"));

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "itemId": "%s",
                        "platform": "Poshmark",
                        "salePrice": -10.00,
                        "platformFees": 0,
                        "soldAt": "2025-06-01T12:00:00Z"
                    }
                    """.formatted(item.id.toHexString()))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(400);
        }
    }

    @Nested @DisplayName("computed fields")
    class ComputedFields {

        @Test @DisplayName("netProceeds = salePrice - platformFees, profit = netProceeds - purchasePrice")
        void profitComputedCorrectly() {
            Item item = createTestItem(orgId, "Test Item", new BigDecimal("40.00"));

            given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                    {
                        "itemId": "%s",
                        "platform": "Mercari",
                        "salePrice": 100.00,
                        "platformFees": 15.00,
                        "soldAt": "2025-06-01T12:00:00Z"
                    }
                    """.formatted(item.id.toHexString()))
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(201)
                .body("netProceeds", equalTo(85.00f))
                .body("profit", equalTo(45.00f));
        }
    }

    @Nested @DisplayName("GET /sales")
    class ListSales {

        @Test @DisplayName("newest sale appears first")
        void newestFirst() {
            Item item1 = createTestItem(orgId, "Item 1", new BigDecimal("50.00"));
            Item item2 = createTestItem(orgId, "Item 2", new BigDecimal("60.00"));
            createTestSaleInDb(orgId, item1, new BigDecimal("100.00"), new BigDecimal("20.00"),
                    Instant.parse("2025-06-01T12:00:00Z"), "Poshmark");
            createTestSaleInDb(orgId, item2, new BigDecimal("200.00"), new BigDecimal("40.00"),
                    Instant.parse("2025-07-15T12:00:00Z"), "Poshmark");

            given()
                .header("Authorization", "Bearer " + adminToken)
            .when()
                .get("/api/v1/sales")
            .then()
                .statusCode(200)
                .body("size()", equalTo(2))
                .body("[0].salePrice", equalTo(200.00f))
                .body("[1].salePrice", equalTo(100.00f));
        }

        @Test @DisplayName("platform filter returns only matching")
        void platformFilter() {
            Item item1 = createTestItem(orgId, "Item 1", new BigDecimal("50.00"));
            Item item2 = createTestItem(orgId, "Item 2", new BigDecimal("60.00"));
            createTestSaleInDb(orgId, item1, new BigDecimal("100.00"), new BigDecimal("20.00"),
                    Instant.parse("2025-06-01T12:00:00Z"), "Poshmark");
            createTestSaleInDb(orgId, item2, new BigDecimal("200.00"), new BigDecimal("40.00"),
                    Instant.parse("2025-07-15T12:00:00Z"), "Mercari");

            given()
                .header("Authorization", "Bearer " + adminToken)
                .queryParam("platform", "Mercari")
            .when()
                .get("/api/v1/sales")
            .then()
                .statusCode(200)
                .body("size()", equalTo(1))
                .body("[0].platform", equalTo("Mercari"));
        }
    }

    @Nested @DisplayName("GET /sales/:id")
    class GetById {

        @Test @DisplayName("correct org → 200 with item name embedded")
        void correctOrg() {
            Item item = createTestItem(orgId, "Gucci Bag", new BigDecimal("250.00"));
            var sale = createTestSaleInDb(orgId, item, new BigDecimal("400.00"), new BigDecimal("80.00"),
                    Instant.parse("2025-06-01T12:00:00Z"), "Poshmark");

            given()
                .header("Authorization", "Bearer " + adminToken)
            .when()
                .get("/api/v1/sales/{id}", sale.id.toHexString())
            .then()
                .statusCode(200)
                .body("itemName", equalTo("Gucci Bag"))
                .body("itemBrand", equalTo("Gucci"));
        }

        @Test @DisplayName("sale from other org → 404")
        void otherOrg() {
            Item item = createTestItem("other-biz", "Item", new BigDecimal("100.00"));
            var sale = createTestSaleInDb("other-biz", item, new BigDecimal("200.00"), new BigDecimal("40.00"),
                    Instant.parse("2025-06-01T12:00:00Z"), "Poshmark");

            given()
                .header("Authorization", "Bearer " + adminToken)
            .when()
                .get("/api/v1/sales/{id}", sale.id.toHexString())
            .then()
                .statusCode(404);
        }
    }

    @Nested @DisplayName("no token → 401")
    class Unauthenticated {

        @Test @DisplayName("POST /sales → 401")
        void postNoToken() {
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {"itemId":"aaaaaaaaaaaaaaaaaaaaaaaa","platform":"X","salePrice":100,"platformFees":10,"soldAt":"2025-06-01T12:00:00Z"}
                    """)
            .when()
                .post("/api/v1/sales")
            .then()
                .statusCode(401);
        }

        @Test @DisplayName("GET /sales → 401")
        void getListNoToken() {
            given()
            .when()
                .get("/api/v1/sales")
            .then()
                .statusCode(401);
        }

        @Test @DisplayName("GET /sales/:id → 401")
        void getByIdNoToken() {
            given()
            .when()
                .get("/api/v1/sales/aaaaaaaaaaaaaaaaaaaaaaaa")
            .then()
                .statusCode(401);
        }
    }

    // --- helpers ---

    private Item createTestItem(String businessId, String name, BigDecimal purchasePrice) {
        Item item = new Item();
        item.businessId = businessId;
        item.name = name;
        item.brand = "Gucci";
        item.category = "Handbags";
        item.condition = ItemCondition.EXCELLENT;
        item.purchasePrice = new Decimal128(purchasePrice);
        item.purchaseDate = Instant.parse("2025-01-15T00:00:00Z");
        item.status = ItemStatus.AVAILABLE;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();
        itemRepository.persist(item);
        return item;
    }

    private com.bookingplatform.model.Sale createTestSaleInDb(String businessId, Item item,
                                BigDecimal salePrice, BigDecimal platformFees,
                                Instant soldAt, String platform) {
        var sale = new com.bookingplatform.model.Sale();
        sale.businessId = businessId;
        sale.itemId = item.id.toHexString();
        sale.platform = platform;
        sale.salePrice = new Decimal128(salePrice);
        sale.platformFees = new Decimal128(platformFees);
        BigDecimal netProceeds = salePrice.subtract(platformFees);
        BigDecimal profit = netProceeds.subtract(item.purchasePrice.bigDecimalValue());
        sale.netProceeds = new Decimal128(netProceeds);
        sale.profit = new Decimal128(profit);
        sale.soldAt = soldAt;
        sale.createdAt = Instant.now();
        saleRepository.persist(sale);

        item.status = ItemStatus.SOLD;
        itemRepository.update(item);
        return sale;
    }
}

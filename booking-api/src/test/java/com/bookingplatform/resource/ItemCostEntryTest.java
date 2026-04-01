package com.bookingplatform.resource;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemCondition;
import com.bookingplatform.model.ItemStatus;
import com.bookingplatform.model.Sale;
import com.bookingplatform.model.User;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.OrganizationRepository;
import com.bookingplatform.repository.SaleRepository;
import com.bookingplatform.repository.UserRepository;
import com.bookingplatform.security.SecurityEnabledProfile;
import com.bookingplatform.service.AuthService;
import com.bookingplatform.util.MoneyUtils;
import com.mongodb.client.MongoClient;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.mongodb.MongoTestResource;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.bson.types.ObjectId;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for the cost-entry PATCH flow on imported items.
 * Items with {@code costEntryPending=true} allow a one-time update of purchasePrice
 * and purchaseDate. After update, both fields become permanently immutable and
 * any linked sale's profit is recomputed.
 */
@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
@TestProfile(SecurityEnabledProfile.class)
@DisplayName("Item Cost Entry")
class ItemCostEntryTest {

    @Inject ItemRepository itemRepository;
    @Inject SaleRepository saleRepository;
    @Inject OrganizationRepository organizationRepository;
    @Inject UserRepository userRepository;
    @Inject AuthService authService;
    @Inject MongoClient mongoClient;

    @ConfigProperty(name = "quarkus.mongodb.database")
    String databaseName;

    private String adminToken;
    private String orgId;

    @BeforeEach
    void setUp() {
        saleRepository.deleteAll();
        itemRepository.deleteAll();
        userRepository.deleteAll();
        organizationRepository.deleteAll();

        // Register org + admin (Pattern D)
        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                            "orgName": "Cost Entry Test Org",
                            "orgSlug": "cost-test",
                            "adminEmail": "admin@cost-test.com",
                            "adminDisplayName": "Admin"
                        }
                        """)
                .when()
                .post("/api/v1/auth/register")
                .then()
                .statusCode(201);

        User admin = userRepository.findByEmail("admin@cost-test.com").orElseThrow();
        adminToken = authService.generateUserJwt(admin);
        orgId = admin.orgId.toHexString();
    }

    // ─── Tests ───────────────────────────────────────────

    /**
     * A pending-cost item accepts purchasePrice + purchaseDate via PATCH,
     * clears costEntryPending, and returns the updated item.
     */
    @Test
    @DisplayName("pending cost item: update price + date → 200, clears pending flag")
    void test_pendingCostItem_updatePriceAndDate_returns200_clearsPendingFlag() {
        Item item = createPendingCostItem(orgId, "Imported Bag");

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "purchasePrice": 50.00,
                            "purchaseDate": "2024-01-15T00:00:00Z"
                        }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(200)
                .body("costEntryPending", equalTo(false))
                .body("purchasePrice", equalTo(50.00f))
                .body("purchaseDate", notNullValue());
    }

    /**
     * After cost entry completes, purchasePrice and purchaseDate become permanently
     * immutable. A second PATCH attempt returns 400.
     */
    @Test
    @DisplayName("pending cost item: second cost update → 400 (now immutable)")
    void test_pendingCostItem_secondCostUpdate_returns400() {
        Item item = createPendingCostItem(orgId, "Imported Shoes");

        // First PATCH succeeds
        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "purchasePrice": 50.00,
                            "purchaseDate": "2024-01-15T00:00:00Z"
                        }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(200);

        // Second PATCH rejected
        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "purchasePrice": 75.00,
                            "purchaseDate": "2024-02-01T00:00:00Z"
                        }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(400);
    }

    /**
     * A normal item (created via POST, costEntryPending=false from the start)
     * still rejects purchasePrice updates with 400.
     */
    @Test
    @DisplayName("normal item: PATCH purchasePrice → 400")
    void test_normalItem_patchPurchasePrice_returns400() {
        // Create item via POST (costEntryPending=false)
        String itemId = given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "name": "Normal Item",
                            "condition": "GOOD",
                            "purchasePrice": 100.00,
                            "purchaseDate": "2024-01-15T00:00:00Z"
                        }
                        """)
                .when()
                .post("/api/v1/items")
                .then()
                .statusCode(201)
                .extract().path("id");

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        { "purchasePrice": 200.00 }
                        """)
                .when()
                .patch("/api/v1/items/{id}", itemId)
                .then()
                .statusCode(400);
    }

    /**
     * Both purchasePrice and purchaseDate are required together for cost entry.
     * Sending only purchaseDate returns 400.
     */
    @Test
    @DisplayName("pending cost item: missing price → 400")
    void test_pendingCostItem_missingPrice_returns400() {
        Item item = createPendingCostItem(orgId, "Missing Price");

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        { "purchaseDate": "2024-01-15T00:00:00Z" }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(400);
    }

    /**
     * Both purchasePrice and purchaseDate are required together for cost entry.
     * Sending only purchasePrice returns 400.
     */
    @Test
    @DisplayName("pending cost item: missing date → 400")
    void test_pendingCostItem_missingDate_returns400() {
        Item item = createPendingCostItem(orgId, "Missing Date");

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        { "purchasePrice": 50.00 }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(400);
    }

    /**
     * Negative purchasePrice is rejected with 400.
     */
    @Test
    @DisplayName("pending cost item: negative purchasePrice → 400")
    void test_pendingCostItem_negativePurchasePrice_returns400() {
        Item item = createPendingCostItem(orgId, "Negative Price");

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "purchasePrice": -1.00,
                            "purchaseDate": "2024-01-15T00:00:00Z"
                        }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(400);
    }

    /**
     * Zero purchasePrice is valid (item was free or gifted).
     */
    @Test
    @DisplayName("pending cost item: zero purchasePrice → 200")
    void test_pendingCostItem_zeroPurchasePrice_returns200() {
        Item item = createPendingCostItem(orgId, "Free Item");

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "purchasePrice": 0.00,
                            "purchaseDate": "2024-01-15T00:00:00Z"
                        }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(200)
                .body("costEntryPending", equalTo(false));
    }

    /**
     * Future purchaseDate is rejected with 400.
     */
    @Test
    @DisplayName("pending cost item: future purchaseDate → 400")
    void test_pendingCostItem_futurePurchaseDate_returns400() {
        Item item = createPendingCostItem(orgId, "Future Date");
        String tomorrow = Instant.now().plus(1, ChronoUnit.DAYS).toString();

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "purchasePrice": 50.00,
                            "purchaseDate": "%s"
                        }
                        """.formatted(tomorrow))
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(400);
    }

    /**
     * When cost is updated on a pending item that has a linked sale, the sale's
     * profit is recomputed: profit = netProceeds - newPurchasePrice.
     */
    @Test
    @DisplayName("pending cost item: recomputes linked sale profit")
    void test_pendingCostItem_recomputesLinkedSaleProfit() {
        Item item = createPendingCostItem(orgId, "Recompute Item");

        // Create linked sale with netProceeds=65.25, profit=65.25 (purchasePrice was 0)
        Sale sale = new Sale();
        sale.businessId = orgId;
        sale.itemId = item.id.toHexString();
        sale.platform = "Poshmark";
        sale.salePrice = new Decimal128(new BigDecimal("80.00"));
        sale.platformFees = new Decimal128(new BigDecimal("14.75"));
        sale.netProceeds = new Decimal128(new BigDecimal("65.25"));
        sale.profit = new Decimal128(new BigDecimal("65.25")); // purchasePrice was 0
        sale.soldAt = Instant.parse("2024-06-01T00:00:00Z");
        sale.createdAt = Instant.now();
        saleRepository.persist(sale);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "purchasePrice": 50.00,
                            "purchaseDate": "2024-01-15T00:00:00Z"
                        }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(200);

        // Verify sale profit was recomputed: 65.25 - 50.00 = 15.25
        Sale updated = saleRepository.findById(sale.id);
        assertEquals(0, new BigDecimal("15.25").compareTo(updated.profit.bigDecimalValue()),
                "profit should be recomputed to 15.25");
    }

    /**
     * Cost entry succeeds even when there is no linked sale.
     */
    @Test
    @DisplayName("pending cost item: no linked sale → 200")
    void test_pendingCostItem_noLinkedSale_returns200() {
        Item item = createPendingCostItem(orgId, "No Sale Item");

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "purchasePrice": 30.00,
                            "purchaseDate": "2024-01-15T00:00:00Z"
                        }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(200)
                .body("costEntryPending", equalTo(false));
    }

    /**
     * When multiple sales are linked to one item, only the latest by saleDate
     * has its profit recomputed. The response includes an X-Warning header.
     */
    @Test
    @DisplayName("pending cost item: multiple linked sales → updates latest, X-Warning header")
    void test_pendingCostItem_multipleLinkedSales_updatesLatestByDate_returnsWarningHeader() {
        Item item = createPendingCostItem(orgId, "Multi-Sale Item");

        // Sale A: earlier date
        Sale saleA = new Sale();
        saleA.businessId = orgId;
        saleA.itemId = item.id.toHexString();
        saleA.platform = "Poshmark";
        saleA.salePrice = new Decimal128(new BigDecimal("50.00"));
        saleA.platformFees = new Decimal128(new BigDecimal("10.00"));
        saleA.netProceeds = new Decimal128(new BigDecimal("40.00"));
        saleA.profit = new Decimal128(new BigDecimal("40.00"));
        saleA.soldAt = Instant.parse("2024-01-01T00:00:00Z");
        saleA.createdAt = Instant.now();
        saleRepository.persist(saleA);

        // Sale B: later date
        Sale saleB = new Sale();
        saleB.businessId = orgId;
        saleB.itemId = item.id.toHexString();
        saleB.platform = "eBay";
        saleB.salePrice = new Decimal128(new BigDecimal("80.00"));
        saleB.platformFees = new Decimal128(new BigDecimal("15.00"));
        saleB.netProceeds = new Decimal128(new BigDecimal("65.00"));
        saleB.profit = new Decimal128(new BigDecimal("65.00"));
        saleB.soldAt = Instant.parse("2024-06-01T00:00:00Z");
        saleB.createdAt = Instant.now();
        saleRepository.persist(saleB);

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        {
                            "purchasePrice": 20.00,
                            "purchaseDate": "2023-12-01T00:00:00Z"
                        }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(200)
                .header("X-Warning", equalTo("multiple-sales-found"));

        // Sale B (latest) profit recomputed: 65.00 - 20.00 = 45.00
        Sale updatedB = saleRepository.findById(saleB.id);
        assertEquals(0, new BigDecimal("45.00").compareTo(updatedB.profit.bigDecimalValue()),
                "Sale B profit should be 45.00");

        // Sale A (older) profit unchanged: still 40.00
        Sale updatedA = saleRepository.findById(saleA.id);
        assertEquals(0, new BigDecimal("40.00").compareTo(updatedA.profit.bigDecimalValue()),
                "Sale A profit should remain 40.00");
    }

    /**
     * Cross-org IDOR protection: patching an item from org A using org B's JWT
     * returns 404.
     */
    @Test
    @DisplayName("pending cost item: cross-org PATCH → 404")
    void test_pendingCostItem_crossOrg_returns404() {
        Item item = createPendingCostItem(orgId, "Org A Item");

        // Register a second org
        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                            "orgName": "Other Org",
                            "orgSlug": "other-org",
                            "adminEmail": "admin@other.com",
                            "adminDisplayName": "Other Admin"
                        }
                        """)
                .when()
                .post("/api/v1/auth/register")
                .then()
                .statusCode(201);

        User otherAdmin = userRepository.findByEmail("admin@other.com").orElseThrow();
        String otherToken = authService.generateUserJwt(otherAdmin);

        // Attempt to PATCH item from org A using org B's token
        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + otherToken)
                .body("""
                        {
                            "purchasePrice": 50.00,
                            "purchaseDate": "2024-01-15T00:00:00Z"
                        }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(404);

        // Verify item is unchanged
        Item unchanged = itemRepository.findById(item.id);
        assertTrue(unchanged.costEntryPending, "costEntryPending should still be true");
        assertEquals(0, BigDecimal.ZERO.compareTo(unchanged.purchasePrice.bigDecimalValue()),
                "purchasePrice should still be 0");
    }

    /**
     * Updating mutable fields (name, brand, etc.) on a pending-cost item should
     * succeed without affecting the costEntryPending flag or purchasePrice.
     */
    @Test
    @DisplayName("pending cost item: PATCH mutable fields → 200, costEntryPending unchanged")
    void test_pendingCostItem_patchMutableFields_returns200_pendingUnchanged() {
        Item item = createPendingCostItem(orgId, "Original Name");

        given()
                .contentType(ContentType.JSON)
                .header("Authorization", "Bearer " + adminToken)
                .body("""
                        { "name": "Updated Name", "brand": "New Brand" }
                        """)
                .when()
                .patch("/api/v1/items/{id}", item.id.toHexString())
                .then()
                .statusCode(200)
                .body("name", equalTo("Updated Name"))
                .body("brand", equalTo("New Brand"))
                .body("costEntryPending", equalTo(true))
                .body("purchasePrice", equalTo(0));
    }

    // ─── Helpers ─────────────────────────────────────────

    /**
     * Creates and persists an item with costEntryPending=true and purchasePrice=0,
     * simulating an imported item whose cost hasn't been confirmed yet.
     */
    private Item createPendingCostItem(String businessId, String name) {
        Item item = new Item();
        item.businessId = businessId;
        item.name = name;
        item.brand = "Imported";
        item.category = "Imported";
        item.condition = ItemCondition.GOOD;
        item.purchasePrice = new Decimal128(BigDecimal.ZERO);
        item.purchaseDate = null;
        item.status = ItemStatus.AVAILABLE;
        item.costEntryPending = true;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();
        itemRepository.persist(item);
        return item;
    }
}

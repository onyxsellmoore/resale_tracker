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
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.mongodb.MongoTestResource;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

/**
 * Tests that the analytics endpoint correctly includes zero-cost imports in profit
 * totals and reports the count of items still awaiting cost entry.
 */
@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
@TestProfile(SecurityEnabledProfile.class)
@DisplayName("Analytics — Pending Cost")
class AnalyticsPendingCostTest {

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

        // Register org + admin (Pattern D)
        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                            "orgName": "Analytics Pending Test Org",
                            "orgSlug": "analytics-pending",
                            "adminEmail": "admin@analytics-pending.com",
                            "adminDisplayName": "Admin"
                        }
                        """)
                .when()
                .post("/api/v1/auth/register")
                .then()
                .statusCode(201);

        User admin = userRepository.findByEmail("admin@analytics-pending.com").orElseThrow();
        adminToken = authService.generateUserJwt(admin);
        orgId = admin.orgId.toHexString();
    }

    // ─── Tests ───────────────────────────────────────────

    /**
     * All sales contribute to totalProfit and totalRevenue, including those linked
     * to items with costEntryPending=true (where purchasePrice defaults to 0).
     * pendingCostItemsCount reflects how many items still need cost entry.
     */
    @Test
    @DisplayName("profit includes zero-cost imports, pendingCostItemsCount = 1")
    void test_analytics_profitIncludesZeroCostImports() {
        // Item 1 & 2: real cost entered (costEntryPending=false)
        Item item1 = createItem(orgId, "Item 1", new BigDecimal("10.00"), false);
        Item item2 = createItem(orgId, "Item 2", new BigDecimal("10.00"), false);
        // Item 3: imported, cost not entered (costEntryPending=true, purchasePrice=0)
        Item item3 = createItem(orgId, "Item 3", BigDecimal.ZERO, true);

        // Sale 1: profit=50, netProceeds=60 (salePrice=70, fees=10, cost=10)
        createSale(orgId, item1, new BigDecimal("70.00"), new BigDecimal("10.00"),
                new BigDecimal("60.00"), new BigDecimal("50.00"), "2024-06-01T00:00:00Z");
        // Sale 2: profit=50, netProceeds=60
        createSale(orgId, item2, new BigDecimal("70.00"), new BigDecimal("10.00"),
                new BigDecimal("60.00"), new BigDecimal("50.00"), "2024-06-15T00:00:00Z");
        // Sale 3: profit=40, netProceeds=40 (purchasePrice=0)
        createSale(orgId, item3, new BigDecimal("50.00"), new BigDecimal("10.00"),
                new BigDecimal("40.00"), new BigDecimal("40.00"), "2024-06-20T00:00:00Z");

        given()
                .header("Authorization", "Bearer " + adminToken)
                .queryParam("from", "2024-01-01")
                .queryParam("to", "2024-12-31")
                .when()
                .get("/api/v1/analytics")
                .then()
                .statusCode(200)
                .body("summary.totalProfit", equalTo(140.00f))
                .body("summary.totalRevenue", equalTo(190.00f))
                .body("pendingCostItemsCount", equalTo(1));
    }

    /**
     * pendingCostItemsCount accurately reflects the number of items with
     * costEntryPending=true, regardless of whether they have linked sales.
     */
    @Test
    @DisplayName("pendingCostItemsCount is accurate across mixed items")
    void test_analytics_pendingCostItemsCount_isAccurate() {
        createItem(orgId, "Pending 1", BigDecimal.ZERO, true);
        createItem(orgId, "Pending 2", BigDecimal.ZERO, true);
        createItem(orgId, "Done 1", new BigDecimal("10.00"), false);
        createItem(orgId, "Done 2", new BigDecimal("20.00"), false);
        createItem(orgId, "Done 3", new BigDecimal("30.00"), false);

        given()
                .header("Authorization", "Bearer " + adminToken)
                .queryParam("from", "2024-01-01")
                .queryParam("to", "2024-12-31")
                .when()
                .get("/api/v1/analytics")
                .then()
                .statusCode(200)
                .body("pendingCostItemsCount", equalTo(2));
    }

    /**
     * When all items have real costs, pendingCostItemsCount is 0.
     */
    @Test
    @DisplayName("all costs entered → pendingCostItemsCount = 0")
    void test_analytics_allCostsEntered_pendingCountIsZero() {
        createItem(orgId, "A", new BigDecimal("10.00"), false);
        createItem(orgId, "B", new BigDecimal("20.00"), false);
        createItem(orgId, "C", new BigDecimal("30.00"), false);

        given()
                .header("Authorization", "Bearer " + adminToken)
                .queryParam("from", "2024-01-01")
                .queryParam("to", "2024-12-31")
                .when()
                .get("/api/v1/analytics")
                .then()
                .statusCode(200)
                .body("pendingCostItemsCount", equalTo(0));
    }

    /**
     * After a cost entry PATCH, analytics totalProfit reflects the recomputed sale
     * profit and pendingCostItemsCount drops to 0.
     */
    @Test
    @DisplayName("profit reflects updated cost after PATCH, pending count drops")
    void test_analytics_profitReflectsUpdatedCost() {
        Item item = createItem(orgId, "Pending Item", BigDecimal.ZERO, true);

        // Sale: profit=50 (because purchasePrice was 0, net=50)
        createSale(orgId, item, new BigDecimal("60.00"), new BigDecimal("10.00"),
                new BigDecimal("50.00"), new BigDecimal("50.00"), "2024-06-01T00:00:00Z");

        // PATCH cost to 30.00 → profit should become 50 - 30 = 20
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
                .statusCode(200);

        given()
                .header("Authorization", "Bearer " + adminToken)
                .queryParam("from", "2024-01-01")
                .queryParam("to", "2024-12-31")
                .when()
                .get("/api/v1/analytics")
                .then()
                .statusCode(200)
                .body("summary.totalProfit", equalTo(20.00f))
                .body("pendingCostItemsCount", equalTo(0));
    }

    // ─── Helpers ─────────────────────────────────────────

    /**
     * Creates and persists an Item with the given purchasePrice and costEntryPending flag.
     * Status is set to AVAILABLE. purchaseDate is set only for non-pending items.
     */
    private Item createItem(String businessId, String name, BigDecimal purchasePrice,
                            boolean costEntryPending) {
        Item item = new Item();
        item.businessId = businessId;
        item.name = name;
        item.brand = "Test";
        item.category = "Test";
        item.condition = ItemCondition.GOOD;
        item.purchasePrice = new Decimal128(purchasePrice);
        item.purchaseDate = costEntryPending ? null : Instant.parse("2024-01-01T00:00:00Z");
        item.status = ItemStatus.AVAILABLE;
        item.costEntryPending = costEntryPending;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();
        itemRepository.persist(item);
        return item;
    }

    /**
     * Creates and persists a Sale linked to the given item with explicit money fields.
     * Marks the item as SOLD.
     */
    private Sale createSale(String businessId, Item item, BigDecimal salePrice,
                            BigDecimal platformFees, BigDecimal netProceeds,
                            BigDecimal profit, String soldAtStr) {
        Sale sale = new Sale();
        sale.businessId = businessId;
        sale.itemId = item.id.toHexString();
        sale.platform = "Poshmark";
        sale.salePrice = new Decimal128(salePrice);
        sale.platformFees = new Decimal128(platformFees);
        sale.netProceeds = new Decimal128(netProceeds);
        sale.profit = new Decimal128(profit);
        sale.soldAt = Instant.parse(soldAtStr);
        sale.createdAt = Instant.now();
        saleRepository.persist(sale);

        item.status = ItemStatus.SOLD;
        item.updatedAt = Instant.now();
        itemRepository.update(item);

        return sale;
    }
}

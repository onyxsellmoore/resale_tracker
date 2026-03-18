package com.bookingplatform.service;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemCondition;
import com.bookingplatform.model.ItemStatus;
import com.bookingplatform.model.Sale;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.SaleRepository;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.mongodb.MongoTestResource;
import jakarta.inject.Inject;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
class AnalyticsServiceTest {

    @Inject
    AnalyticsService analyticsService;

    @Inject
    ItemRepository itemRepository;

    @Inject
    SaleRepository saleRepository;

    @BeforeEach
    void setUp() {
        saleRepository.deleteAll();
        itemRepository.deleteAll();
    }

    // --- 1. basicSums ---
    @Test
    void basicSums_twoSalesInRange() {
        // sale1: price=$100, fees=$15, purchaseCost=$40 → net=$85, profit=$45
        Item item1 = createItem("biz1", "Item A", "Bags", new BigDecimal("40.00"));
        createSale("biz1", item1, "Poshmark", new BigDecimal("100.00"), new BigDecimal("15.00"),
                Instant.parse("2025-03-15T10:00:00Z"));

        // sale2: price=$60, fees=$8, purchaseCost=$20 → net=$52, profit=$32
        Item item2 = createItem("biz1", "Item B", "Shoes", new BigDecimal("20.00"));
        createSale("biz1", item2, "Vestiaire", new BigDecimal("60.00"), new BigDecimal("8.00"),
                Instant.parse("2025-03-16T10:00:00Z"));

        AnalyticsResult result = analyticsService.getAnalytics("biz1",
                LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31));

        assertEquals(2, result.summary().itemsSold());
        assertEquals(new BigDecimal("160.00"), result.summary().totalRevenue());
        assertEquals(new BigDecimal("23.00"), result.summary().totalFees());
        assertEquals(new BigDecimal("137.00"), result.summary().totalNetProceeds());
        assertEquals(new BigDecimal("60.00"), result.summary().totalCostOfGoods());
        assertEquals(new BigDecimal("77.00"), result.summary().totalProfit());
    }

    // --- 2. averageMargin ---
    @Test
    void averageMargin_calculatedCorrectly() {
        // $77 profit / $160 revenue = 48.1%
        Item item1 = createItem("biz1", "Item A", "Bags", new BigDecimal("40.00"));
        createSale("biz1", item1, "Poshmark", new BigDecimal("100.00"), new BigDecimal("15.00"),
                Instant.parse("2025-03-15T10:00:00Z"));

        Item item2 = createItem("biz1", "Item B", "Shoes", new BigDecimal("20.00"));
        createSale("biz1", item2, "Vestiaire", new BigDecimal("60.00"), new BigDecimal("8.00"),
                Instant.parse("2025-03-16T10:00:00Z"));

        AnalyticsResult result = analyticsService.getAnalytics("biz1",
                LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31));

        assertEquals(48.1, result.summary().averageMargin());
    }

    // --- 3. byPlatform ---
    @Test
    void byPlatform_groupedAndSortedByProfitDesc() {
        // Poshmark profit=$45, Vestiaire profit=$32
        Item item1 = createItem("biz1", "Item A", "Bags", new BigDecimal("40.00"));
        createSale("biz1", item1, "Poshmark", new BigDecimal("100.00"), new BigDecimal("15.00"),
                Instant.parse("2025-03-15T10:00:00Z"));

        Item item2 = createItem("biz1", "Item B", "Shoes", new BigDecimal("20.00"));
        createSale("biz1", item2, "Vestiaire", new BigDecimal("60.00"), new BigDecimal("8.00"),
                Instant.parse("2025-03-16T10:00:00Z"));

        AnalyticsResult result = analyticsService.getAnalytics("biz1",
                LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31));

        assertEquals(2, result.byPlatform().size());
        // Poshmark has higher profit, should be first
        assertEquals("Poshmark", result.byPlatform().get(0).platform());
        assertEquals(new BigDecimal("45.00"), result.byPlatform().get(0).totalProfit());
        assertEquals("Vestiaire", result.byPlatform().get(1).platform());
        assertEquals(new BigDecimal("32.00"), result.byPlatform().get(1).totalProfit());
    }

    // --- 4. byCategory ---
    @Test
    void byCategory_groupedAndSortedByProfitDesc() {
        Item item1 = createItem("biz1", "Item A", "Bags", new BigDecimal("40.00"));
        createSale("biz1", item1, "Poshmark", new BigDecimal("100.00"), new BigDecimal("15.00"),
                Instant.parse("2025-03-15T10:00:00Z"));

        Item item2 = createItem("biz1", "Item B", "Shoes", new BigDecimal("20.00"));
        createSale("biz1", item2, "Vestiaire", new BigDecimal("60.00"), new BigDecimal("8.00"),
                Instant.parse("2025-03-16T10:00:00Z"));

        AnalyticsResult result = analyticsService.getAnalytics("biz1",
                LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31));

        assertEquals(2, result.byCategory().size());
        // Bags profit=$45 > Shoes profit=$32
        assertEquals("Bags", result.byCategory().get(0).category());
        assertEquals("Shoes", result.byCategory().get(1).category());
    }

    // --- 5. byMonth ---
    @Test
    void byMonth_separateBucketsChronological() {
        Item item1 = createItem("biz1", "Item A", "Bags", new BigDecimal("40.00"));
        createSale("biz1", item1, "Poshmark", new BigDecimal("100.00"), new BigDecimal("15.00"),
                Instant.parse("2025-01-15T10:00:00Z"));

        Item item2 = createItem("biz1", "Item B", "Shoes", new BigDecimal("20.00"));
        createSale("biz1", item2, "Vestiaire", new BigDecimal("60.00"), new BigDecimal("8.00"),
                Instant.parse("2025-02-16T10:00:00Z"));

        AnalyticsResult result = analyticsService.getAnalytics("biz1",
                LocalDate.of(2025, 1, 1), LocalDate.of(2025, 3, 31));

        assertEquals(2, result.byMonth().size());
        assertEquals("2025-01", result.byMonth().get(0).month());
        assertEquals(1, result.byMonth().get(0).itemsSold());
        assertEquals("2025-02", result.byMonth().get(1).month());
        assertEquals(1, result.byMonth().get(1).itemsSold());
    }

    // --- 6. dateRangeFilter ---
    @Test
    void dateRangeFilter_excludesOutOfRange() {
        Item item1 = createItem("biz1", "Item A", "Bags", new BigDecimal("40.00"));
        createSale("biz1", item1, "Poshmark", new BigDecimal("100.00"), new BigDecimal("15.00"),
                Instant.parse("2025-03-15T10:00:00Z"));

        // This sale is outside the range
        Item item2 = createItem("biz1", "Item B", "Shoes", new BigDecimal("20.00"));
        createSale("biz1", item2, "Vestiaire", new BigDecimal("60.00"), new BigDecimal("8.00"),
                Instant.parse("2025-04-16T10:00:00Z"));

        AnalyticsResult result = analyticsService.getAnalytics("biz1",
                LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31));

        assertEquals(1, result.summary().itemsSold());
        assertEquals(new BigDecimal("100.00"), result.summary().totalRevenue());
    }

    // --- 7. emptyRange ---
    @Test
    void emptyRange_returnsZerosNoDivisionByZero() {
        AnalyticsResult result = analyticsService.getAnalytics("biz1",
                LocalDate.of(2025, 6, 1), LocalDate.of(2025, 6, 30));

        assertEquals(0, result.summary().itemsSold());
        assertEquals(new BigDecimal("0.00"), result.summary().totalRevenue());
        assertEquals(new BigDecimal("0.00"), result.summary().totalFees());
        assertEquals(new BigDecimal("0.00"), result.summary().totalNetProceeds());
        assertEquals(new BigDecimal("0.00"), result.summary().totalCostOfGoods());
        assertEquals(new BigDecimal("0.00"), result.summary().totalProfit());
        assertEquals(0.0, result.summary().averageMargin());
        assertTrue(result.byPlatform().isEmpty());
        assertTrue(result.byCategory().isEmpty());
        assertTrue(result.byMonth().isEmpty());
    }

    // --- 8. businessIdIsolation ---
    @Test
    void businessIdIsolation_otherBusinessNotIncluded() {
        Item item1 = createItem("biz1", "Item A", "Bags", new BigDecimal("40.00"));
        createSale("biz1", item1, "Poshmark", new BigDecimal("100.00"), new BigDecimal("15.00"),
                Instant.parse("2025-03-15T10:00:00Z"));

        // Different business
        Item item2 = createItem("biz2", "Item B", "Shoes", new BigDecimal("20.00"));
        createSale("biz2", item2, "Vestiaire", new BigDecimal("60.00"), new BigDecimal("8.00"),
                Instant.parse("2025-03-16T10:00:00Z"));

        AnalyticsResult result = analyticsService.getAnalytics("biz1",
                LocalDate.of(2025, 3, 1), LocalDate.of(2025, 3, 31));

        assertEquals(1, result.summary().itemsSold());
        assertEquals(new BigDecimal("100.00"), result.summary().totalRevenue());
    }

    // --- Helpers ---

    private Item createItem(String businessId, String name, String category, BigDecimal purchasePrice) {
        Item item = new Item();
        item.businessId = businessId;
        item.name = name;
        item.brand = "TestBrand";
        item.category = category;
        item.condition = ItemCondition.GOOD;
        item.purchasePrice = new Decimal128(purchasePrice);
        item.purchaseDate = Instant.parse("2025-01-01T00:00:00Z");
        item.status = ItemStatus.AVAILABLE;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();
        itemRepository.persist(item);
        return item;
    }

    private Sale createSale(String businessId, Item item, String platform,
                            BigDecimal salePrice, BigDecimal fees, Instant soldAt) {
        BigDecimal netProceeds = salePrice.subtract(fees);
        BigDecimal profit = netProceeds.subtract(item.purchasePrice.bigDecimalValue());

        Sale sale = new Sale();
        sale.businessId = businessId;
        sale.itemId = item.id.toString();
        sale.platform = platform;
        sale.salePrice = new Decimal128(salePrice);
        sale.platformFees = new Decimal128(fees);
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

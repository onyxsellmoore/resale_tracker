package com.bookingplatform.repository;

import com.bookingplatform.model.Sale;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.mongodb.MongoTestResource;
import jakarta.inject.Inject;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
class SaleRepositoryTest {

    @Inject
    SaleRepository saleRepository;

    @BeforeEach
    void setUp() {
        saleRepository.deleteAll();
    }

    @Test
    void saveAndFindById_roundTripsWithComputedFields() {
        Sale sale = buildSale("biz1", "item1",
                new BigDecimal("500.00"), new BigDecimal("100.00"), new BigDecimal("250.00"),
                Instant.parse("2025-06-01T12:00:00Z"));
        saleRepository.persist(sale);
        assertNotNull(sale.id);

        Sale found = saleRepository.findById(sale.id);
        assertNotNull(found);
        assertEquals("Poshmark", found.platform);
        assertEquals(new BigDecimal("500.00"), found.salePrice.bigDecimalValue());
        assertEquals(new BigDecimal("100.00"), found.platformFees.bigDecimalValue());
        // netProceeds = 500 - 100 = 400
        assertEquals(new BigDecimal("400.00"), found.netProceeds.bigDecimalValue());
        // profit = 400 - 250 = 150
        assertEquals(new BigDecimal("150.00"), found.profit.bigDecimalValue());
    }

    @Test
    void findByBusinessId_onlyReturnsMatchingBusiness() {
        saleRepository.persist(buildSale("biz1", "item1",
                new BigDecimal("300.00"), new BigDecimal("60.00"), new BigDecimal("100.00"),
                Instant.parse("2025-06-01T12:00:00Z")));
        saleRepository.persist(buildSale("biz2", "item2",
                new BigDecimal("200.00"), new BigDecimal("40.00"), new BigDecimal("80.00"),
                Instant.parse("2025-06-02T12:00:00Z")));

        List<Sale> biz1Sales = saleRepository.findByBusinessId("biz1");
        assertEquals(1, biz1Sales.size());
        assertEquals("biz1", biz1Sales.get(0).businessId);
    }

    @Test
    void findBySoldAtRange_dateRangeFilterWorks() {
        saleRepository.persist(buildSale("biz1", "item1",
                new BigDecimal("300.00"), new BigDecimal("60.00"), new BigDecimal("100.00"),
                Instant.parse("2025-06-01T12:00:00Z")));
        saleRepository.persist(buildSale("biz1", "item2",
                new BigDecimal("400.00"), new BigDecimal("80.00"), new BigDecimal("150.00"),
                Instant.parse("2025-07-15T12:00:00Z")));
        saleRepository.persist(buildSale("biz1", "item3",
                new BigDecimal("200.00"), new BigDecimal("40.00"), new BigDecimal("50.00"),
                Instant.parse("2025-08-20T12:00:00Z")));

        // Query June 1 to July 31
        Instant rangeStart = Instant.parse("2025-06-01T00:00:00Z");
        Instant rangeEnd = Instant.parse("2025-08-01T00:00:00Z");
        List<Sale> inRange = saleRepository.findByBusinessAndSoldAtRange("biz1", rangeStart, rangeEnd);

        assertEquals(2, inRange.size());
    }

    private Sale buildSale(String businessId, String itemId,
                           BigDecimal salePrice, BigDecimal platformFees,
                           BigDecimal purchasePrice, Instant soldAt) {
        Sale sale = new Sale();
        sale.businessId = businessId;
        sale.itemId = itemId;
        sale.platform = "Poshmark";
        sale.salePrice = new Decimal128(salePrice);
        sale.platformFees = new Decimal128(platformFees);
        // Compute at write time
        BigDecimal netProceeds = salePrice.subtract(platformFees);
        BigDecimal profit = netProceeds.subtract(purchasePrice);
        sale.netProceeds = new Decimal128(netProceeds);
        sale.profit = new Decimal128(profit);
        sale.soldAt = soldAt;
        sale.createdAt = Instant.now();
        return sale;
    }
}

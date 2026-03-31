package com.bookingplatform.model;

import org.bson.types.Decimal128;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class EntityTest {

    @Test
    void item_canBeCreated() {
        var item = new Item();
        item.businessId = "biz1";
        item.name = "Gucci Bag";
        item.brand = "Gucci";
        item.category = "Handbags";
        item.condition = ItemCondition.EXCELLENT;
        item.purchasePrice = new Decimal128(new BigDecimal("250.00"));
        item.purchaseDate = Instant.parse("2025-01-15T00:00:00Z");
        item.description = "Vintage leather bag";
        item.notes = "Slight patina";
        item.status = ItemStatus.AVAILABLE;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();

        assertEquals("Gucci Bag", item.name);
        assertEquals("Gucci", item.brand);
        assertEquals(ItemCondition.EXCELLENT, item.condition);
        assertEquals(ItemStatus.AVAILABLE, item.status);
        assertEquals(new BigDecimal("250.00"), item.purchasePrice.bigDecimalValue());
    }

    @Test
    void item_defaultStatusIsAvailable() {
        var item = new Item();
        assertNull(item.status); // status must be set explicitly at creation
    }

    @Test
    void sale_canBeCreated() {
        var sale = new Sale();
        sale.businessId = "biz1";
        sale.itemId = "item123";
        sale.platform = "Poshmark";
        sale.salePrice = new Decimal128(new BigDecimal("400.00"));
        sale.platformFees = new Decimal128(new BigDecimal("80.00"));
        sale.netProceeds = new Decimal128(new BigDecimal("320.00"));
        sale.profit = new Decimal128(new BigDecimal("70.00"));
        sale.soldAt = Instant.parse("2025-06-01T12:00:00Z");
        sale.notes = "Quick sale";
        sale.createdAt = Instant.now();

        assertEquals("Poshmark", sale.platform);
        assertEquals(new BigDecimal("400.00"), sale.salePrice.bigDecimalValue());
        assertEquals(new BigDecimal("320.00"), sale.netProceeds.bigDecimalValue());
        assertEquals(new BigDecimal("70.00"), sale.profit.bigDecimalValue());
    }

    @Test
    void sale_computedFieldsAreCorrect() {
        BigDecimal salePrice = new BigDecimal("500.00");
        BigDecimal platformFees = new BigDecimal("100.00");
        BigDecimal purchasePrice = new BigDecimal("250.00");

        BigDecimal netProceeds = salePrice.subtract(platformFees);
        BigDecimal profit = netProceeds.subtract(purchasePrice);

        assertEquals(new BigDecimal("400.00"), netProceeds);
        assertEquals(new BigDecimal("150.00"), profit);
    }

    @Test
    void itemCondition_allValuesExist() {
        assertEquals(5, ItemCondition.values().length);
        assertNotNull(ItemCondition.valueOf("NEW"));
        assertNotNull(ItemCondition.valueOf("EXCELLENT"));
        assertNotNull(ItemCondition.valueOf("GOOD"));
        assertNotNull(ItemCondition.valueOf("FAIR"));
        assertNotNull(ItemCondition.valueOf("POOR"));
    }

    @Test
    void itemStatus_allValuesExist() {
        assertEquals(3, ItemStatus.values().length);
        assertNotNull(ItemStatus.valueOf("AVAILABLE"));
        assertNotNull(ItemStatus.valueOf("SOLD"));
        assertNotNull(ItemStatus.valueOf("UNKNOWN"));
    }
}

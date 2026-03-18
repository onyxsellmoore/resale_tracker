package com.bookingplatform.util;

import org.bson.types.Decimal128;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MoneyTest {

    @Test
    void toDecimal128_fromBigDecimal() {
        BigDecimal price = new BigDecimal("49.99");
        Decimal128 result = MoneyUtils.toDecimal128(price);
        assertEquals(new Decimal128(new BigDecimal("49.99")), result);
    }

    @Test
    void toBigDecimal_fromDecimal128() {
        Decimal128 stored = new Decimal128(new BigDecimal("49.99"));
        BigDecimal result = MoneyUtils.toBigDecimal(stored);
        assertEquals(new BigDecimal("49.99"), result);
    }

    @Test
    void addPriceAndDeposit() {
        BigDecimal price = new BigDecimal("100.00");
        BigDecimal deposit = new BigDecimal("25.50");
        BigDecimal remaining = MoneyUtils.remaining(price, deposit);
        assertEquals(new BigDecimal("74.50"), remaining);
    }

    @Test
    void depositExceedsPrice_returnsZero() {
        BigDecimal price = new BigDecimal("20.00");
        BigDecimal deposit = new BigDecimal("25.00");
        BigDecimal remaining = MoneyUtils.remaining(price, deposit);
        assertEquals(BigDecimal.ZERO, remaining);
    }

    @Test
    void roundTrip_bigDecimalThroughDecimal128() {
        BigDecimal original = new BigDecimal("199.95");
        Decimal128 d128 = MoneyUtils.toDecimal128(original);
        BigDecimal backAgain = MoneyUtils.toBigDecimal(d128);
        assertEquals(original, backAgain);
    }

    @Test
    void nullDecimal128_returnsZero() {
        BigDecimal result = MoneyUtils.toBigDecimal(null);
        assertTrue(result.compareTo(BigDecimal.ZERO) == 0);
    }

    @Test
    void decimal128_preserves_12_50() {
        BigDecimal original = new BigDecimal("12.50");
        Decimal128 stored = new Decimal128(original);
        BigDecimal retrieved = stored.bigDecimalValue();
        assertEquals(original, retrieved);
    }

    @Test
    void profit_computation_noRounding() {
        BigDecimal salePrice = new BigDecimal("500.00");
        BigDecimal platformFees = new BigDecimal("100.00");
        BigDecimal purchasePrice = new BigDecimal("250.00");

        BigDecimal netProceeds = salePrice.subtract(platformFees);
        BigDecimal profit = netProceeds.subtract(purchasePrice);

        assertEquals(new BigDecimal("400.00"), netProceeds);
        assertEquals(new BigDecimal("150.00"), profit);
    }
}

package com.bookingplatform.util;

import org.bson.types.Decimal128;

import java.math.BigDecimal;

public final class MoneyUtils {

    private MoneyUtils() {}

    public static Decimal128 toDecimal128(BigDecimal value) {
        return new Decimal128(value);
    }

    public static BigDecimal toBigDecimal(Decimal128 value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        return value.bigDecimalValue();
    }

    public static BigDecimal remaining(BigDecimal price, BigDecimal deposit) {
        BigDecimal diff = price.subtract(deposit);
        return diff.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : diff;
    }
}

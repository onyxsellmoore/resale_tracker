package com.bookingplatform.imports;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the shared {@link CsvParseUtils} price-parsing utility.
 */
class CsvParseUtilsTest {

    /**
     * Verifies that a dollar sign and comma are stripped before parsing.
     */
    @Test
    void parseMoney_dollarAndComma_stripped() {
        assertEquals(new BigDecimal("1234.56"), CsvParseUtils.parseMoney("$1,234.56", false));
    }

    /**
     * Verifies that a simple decimal value parses correctly.
     */
    @Test
    void parseMoney_plainDecimal_parsed() {
        assertEquals(new BigDecimal("75.00"), CsvParseUtils.parseMoney("75.00", false));
    }

    /**
     * Verifies that null input returns null when blankIsZero is false.
     */
    @Test
    void parseMoney_null_blankIsZeroFalse_returnsNull() {
        assertNull(CsvParseUtils.parseMoney(null, false));
    }

    /**
     * Verifies that null input returns ZERO when blankIsZero is true.
     */
    @Test
    void parseMoney_null_blankIsZeroTrue_returnsZero() {
        assertEquals(BigDecimal.ZERO, CsvParseUtils.parseMoney(null, true));
    }

    /**
     * Verifies that whitespace-only input is treated same as blank.
     */
    @Test
    void parseMoney_whitespaceOnly_blankIsZeroFalse_returnsNull() {
        assertNull(CsvParseUtils.parseMoney("   ", false));
    }

    /**
     * Verifies that whitespace-only input returns ZERO when blankIsZero is true.
     */
    @Test
    void parseMoney_whitespaceOnly_blankIsZeroTrue_returnsZero() {
        assertEquals(BigDecimal.ZERO, CsvParseUtils.parseMoney("   ", true));
    }

    /**
     * Verifies that a non-numeric string returns null.
     */
    @Test
    void parseMoney_nonNumeric_returnsNull() {
        assertNull(CsvParseUtils.parseMoney("N/A", false));
    }

    /**
     * Verifies that a lone "$" (blank after stripping) returns null when blankIsZero is false.
     */
    @Test
    void parseMoney_dollarSignOnly_blankIsZeroFalse_returnsNull() {
        assertNull(CsvParseUtils.parseMoney("$", false));
    }

    /**
     * Verifies that empty string returns null when blankIsZero is false.
     */
    @Test
    void parseMoney_emptyString_blankIsZeroFalse_returnsNull() {
        assertNull(CsvParseUtils.parseMoney("", false));
    }

    /**
     * Verifies that leading/trailing whitespace around a value is stripped.
     */
    @Test
    void parseMoney_paddedValue_stripped() {
        assertEquals(new BigDecimal("42.00"), CsvParseUtils.parseMoney("  42.00  ", false));
    }
}

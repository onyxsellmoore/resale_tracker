package com.bookingplatform.imports;

import java.math.BigDecimal;

/**
 * Shared price-parsing utility used by all platform CSV parsers.
 * Package-private — not a CDI bean.
 */
final class CsvParseUtils {

    private CsvParseUtils() {
        // utility class
    }

    /**
     * Parses a price cell value. Strips whitespace, "$", and "," before parsing.
     *
     * @param raw        the raw cell string (may be null, blank, or formatted)
     * @param blankIsZero if true, returns {@link BigDecimal#ZERO} for blank/null input;
     *                    if false, returns null (caller treats as parse error)
     * @return parsed BigDecimal, {@link BigDecimal#ZERO} if blankIsZero and blank,
     *         or null if unparseable or blank with blankIsZero=false
     */
    static BigDecimal parseMoney(String raw, boolean blankIsZero) {
        if (raw == null || raw.isBlank()) {
            return blankIsZero ? BigDecimal.ZERO : null;
        }
        String cleaned = raw.strip().replace("$", "").replace(",", "");
        if (cleaned.isBlank()) {
            return blankIsZero ? BigDecimal.ZERO : null;
        }
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}

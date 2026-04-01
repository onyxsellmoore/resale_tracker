package com.bookingplatform.imports;

import com.bookingplatform.imports.model.ImportRow;
import com.bookingplatform.imports.model.ParseResult;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link EbayCsvParser}.
 * Plain JUnit 5 — no Quarkus, no CDI. Instantiates parser with {@code new}.
 */
class EbayCsvParserTest {

    /**
     * Verifies that the valid eBay CSV produces exactly 3 rows
     * (the continuation row with blank Order number is skipped).
     */
    @Test
    void parse_validCsv_returns3Rows() throws Exception {
        ParseResult r = new EbayCsvParser().parse(fixture("ebay_valid.csv"));
        assertEquals(3, r.rows().size(), "continuation row must be skipped");
        assertEquals(0, r.errors().size());
    }

    /**
     * Verifies that the UTF-8 BOM is stripped and does not appear in the parsed order ID.
     */
    @Test
    void parse_bomIsStripped() throws Exception {
        ImportRow row = new EbayCsvParser().parse(fixture("ebay_valid.csv")).rows().get(0);
        assertEquals("28-12345-67890", row.externalOrderId(),
            "BOM must not appear in parsed order ID");
    }

    /**
     * Verifies fee summation: fixed (0.30) + variable (9.45) = 9.75,
     * and net proceeds: 75.00 - 9.75 = 65.25.
     */
    @Test
    void parse_feeSummation() throws Exception {
        ImportRow row = new EbayCsvParser().parse(fixture("ebay_valid.csv")).rows().get(0);
        assertEquals(new BigDecimal("9.75"), row.platformFees());
        assertEquals(new BigDecimal("65.25"), row.netProceeds());
    }

    /**
     * Verifies that a CSV missing the required "Order number" header
     * returns a file-level error (rowNumber=-1) and no rows.
     */
    @Test
    void parse_missingRequiredHeader_returnsFileError() throws Exception {
        ParseResult r = new EbayCsvParser().parse(fixture("ebay_missing_required_header.csv"));
        assertTrue(r.rows().isEmpty());
        assertEquals(1, r.errors().size());
        assertEquals(-1, r.errors().get(0).rowNumber());
    }

    /**
     * Verifies correct counts: 2 valid rows (dollar-sign and blank-fixed-fee),
     * 3 errors (N/A, blank price, whitespace price).
     */
    @Test
    void parse_malformedRows_correctCountsOfValidAndErrors() throws Exception {
        ParseResult r = new EbayCsvParser().parse(fixture("ebay_malformed_price.csv"));
        assertEquals(2, r.rows().size(), "dollar-sign row and blank-fixed-fee row are valid");
        assertEquals(3, r.errors().size(), "N/A, blank price, whitespace price each produce error");
    }

    /**
     * Verifies that a "$" prefix on price is stripped and the row parses successfully.
     */
    @Test
    void parse_dollarSignStripped_parsesCorrectly() throws Exception {
        ParseResult r = new EbayCsvParser().parse(fixture("ebay_malformed_price.csv"));
        assertTrue(r.rows().stream().anyMatch(row -> row.externalOrderId().equals("28-33333-44444")),
            "row with $-prefixed price must parse successfully after stripping $");
    }

    /**
     * Verifies that a blank fixed fee cell is treated as 0.00,
     * so total fee = 0.00 + 7.50 = 7.50.
     */
    @Test
    void parse_blankFixedFee_treatedAsZero() throws Exception {
        ParseResult r = new EbayCsvParser().parse(fixture("ebay_malformed_price.csv"));
        ImportRow row = r.rows().stream()
            .filter(rw -> rw.externalOrderId().equals("28-77777-88888"))
            .findFirst().orElseThrow();
        assertEquals(new BigDecimal("7.50"), row.platformFees(),
            "blank fixed fee must be 0.00, so total fee = 0.00 + 7.50 = 7.50");
    }

    /**
     * Verifies that an empty file produces a file-level error and no rows.
     */
    @Test
    void parse_emptyFile_returnsFileError() throws Exception {
        ParseResult r = new EbayCsvParser().parse(new ByteArrayInputStream(new byte[0]));
        assertTrue(r.rows().isEmpty());
        assertEquals(-1, r.errors().get(0).rowNumber());
    }

    /**
     * Verifies that a CSV with only a header row returns empty rows and no errors.
     */
    @Test
    void parse_headerOnly_returnsEmptyRowsNoErrors() throws Exception {
        String csv = "\uFEFFOrder number,Item title,Sale date,Unit price,"
                   + "Final value fee - fixed,Final value fee - variable\n";
        ParseResult r = new EbayCsvParser().parse(
            new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
        assertTrue(r.rows().isEmpty());
        assertTrue(r.errors().isEmpty());
    }

    /**
     * Verifies that headers are matched case-insensitively.
     */
    @Test
    void parse_caseInsensitiveHeaders_parsed() throws Exception {
        String csv = "\uFEFFORDER NUMBER,ITEM TITLE,SALE DATE,UNIT PRICE,"
                   + "FINAL VALUE FEE - FIXED,FINAL VALUE FEE - VARIABLE\n"
                   + "99-00000-11111,Test Item,2024-11-15,50.00,0.30,5.00\n";
        ParseResult r = new EbayCsvParser().parse(
            new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
        assertEquals(1, r.rows().size());
        assertEquals(0, r.errors().size());
    }

    /**
     * Verifies that extra/unknown columns are silently ignored.
     */
    @Test
    void parse_extraColumns_ignoredSilently() throws Exception {
        String csv = "\uFEFFOrder number,Item title,Sale date,Unit price,"
                   + "Final value fee - fixed,Final value fee - variable,Extra Column\n"
                   + "99-00000-11111,Test Item,2024-11-15,50.00,0.30,5.00,ignored\n";
        ParseResult r = new EbayCsvParser().parse(
            new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
        assertEquals(1, r.rows().size());
        assertEquals(0, r.errors().size());
    }

    /**
     * Loads a test fixture CSV from the classpath.
     *
     * @param name the fixture file name under /fixtures/
     * @return an InputStream for the fixture
     */
    private InputStream fixture(String name) {
        return getClass().getResourceAsStream("/fixtures/" + name);
    }
}

package com.bookingplatform.imports;

import com.bookingplatform.imports.model.ParseResult;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit tests for {@link PoshmarkCsvParser}.
 * Plain JUnit 5 — no Quarkus, no CDI. Instantiates parser with {@code new}.
 */
class PoshmarkCsvParserTest {

    /**
     * Verifies that the valid Poshmark CSV produces exactly 2 rows
     * (the $0.00 cancelled row is skipped silently).
     */
    @Test
    void parse_validCsv_returns2Rows() throws Exception {
        ParseResult r = new PoshmarkCsvParser().parse(fixture("poshmark_valid.csv"));
        assertEquals(2, r.rows().size(), "cancelled $0.00 row must be skipped");
        assertEquals(0, r.errors().size());
    }

    /**
     * Verifies net proceeds: row 1 = 80.00 - 16.00 = 64.00,
     * row 2 = 150.00 - 30.00 = 120.00.
     */
    @Test
    void parse_correctNetProceeds() throws Exception {
        ParseResult r = new PoshmarkCsvParser().parse(fixture("poshmark_valid.csv"));
        assertEquals(new BigDecimal("64.00"), r.rows().get(0).netProceeds());
        assertEquals(new BigDecimal("120.00"), r.rows().get(1).netProceeds());
    }

    /**
     * Verifies that a "$" prefix in price fields is stripped correctly.
     * The cancelled row has "$0.00" which should be stripped then skipped (zero price).
     * This test ensures the parser handles "$" without erroring.
     */
    @Test
    void parse_dollarSignInPrice_stripped() throws Exception {
        ParseResult r = new PoshmarkCsvParser().parse(fixture("poshmark_valid.csv"));
        assertEquals(0, r.errors().size(), "dollar sign must be stripped without error");
    }

    /**
     * Verifies that a CSV missing the required "Order" header
     * returns a file-level error (rowNumber=-1) and no rows.
     */
    @Test
    void parse_missingRequiredHeader_returnsFileError() throws Exception {
        String csv = "Title,Date,Price,Fees\nSome Item,Nov 15 2024,80.00,16.00\n";
        ParseResult r = new PoshmarkCsvParser().parse(
            new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
        assertTrue(r.rows().isEmpty());
        assertEquals(1, r.errors().size());
        assertEquals(-1, r.errors().get(0).rowNumber());
    }

    /**
     * Verifies that an empty file produces a file-level error and no rows.
     */
    @Test
    void parse_emptyFile_returnsFileError() throws Exception {
        ParseResult r = new PoshmarkCsvParser().parse(new ByteArrayInputStream(new byte[0]));
        assertTrue(r.rows().isEmpty());
        assertEquals(-1, r.errors().get(0).rowNumber());
    }

    /**
     * Verifies that the Poshmark date format "MMM d yyyy" (e.g. "Nov 15 2024")
     * is parsed correctly to LocalDate 2024-11-15.
     */
    @Test
    void parse_poshmarkDate_parsedCorrectly() {
        ParseResult r = new PoshmarkCsvParser().parse(fixture("poshmark_valid.csv"));
        assertEquals(LocalDate.of(2024, 11, 15), r.rows().get(0).saleDate());
    }

    /**
     * Verifies that a CSV with only a header row returns empty rows and no errors.
     */
    @Test
    void parse_headerOnly_returnsEmptyRowsNoErrors() throws Exception {
        String csv = "Order,Title,Date,Price,Fees\n";
        ParseResult r = new PoshmarkCsvParser().parse(
            new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
        assertTrue(r.rows().isEmpty());
        assertTrue(r.errors().isEmpty());
    }

    /**
     * Verifies that Poshmark date with extra spaces (e.g. "Nov  5 2024") is normalized and parsed.
     */
    @Test
    void parse_dateWithExtraSpaces_parsedCorrectly() throws Exception {
        String csv = "Order,Title,Date,Price,Fees\n"
                   + "12345,Test Item,Nov  5 2024,50.00,10.00\n";
        ParseResult r = new PoshmarkCsvParser().parse(
            new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
        assertEquals(1, r.rows().size());
        assertEquals(LocalDate.of(2024, 11, 5), r.rows().get(0).saleDate());
    }

    /**
     * Verifies that a blank fee cell is treated as BigDecimal.ZERO.
     */
    @Test
    void parse_blankFee_treatedAsZero() throws Exception {
        String csv = "Order,Title,Date,Price,Fees\n"
                   + "12345,Test Item,Nov 15 2024,80.00,\n";
        ParseResult r = new PoshmarkCsvParser().parse(
            new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
        assertEquals(1, r.rows().size());
        assertEquals(new BigDecimal("80.00"), r.rows().get(0).netProceeds());
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

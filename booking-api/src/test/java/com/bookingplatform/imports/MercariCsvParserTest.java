package com.bookingplatform.imports;

import com.bookingplatform.imports.model.ParseResult;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link MercariCsvParser}.
 * Plain JUnit 5 — no Quarkus, no CDI. Instantiates parser with {@code new}.
 */
class MercariCsvParserTest {

    /**
     * Verifies that the valid Mercari CSV produces exactly 2 rows
     * (the $0.00 cancelled row is skipped silently).
     */
    @Test
    void parse_validCsv_returns2Rows() throws Exception {
        ParseResult r = new MercariCsvParser().parse(fixture("mercari_valid.csv"));
        assertEquals(2, r.rows().size(), "cancelled $0.00 row must be skipped");
        assertEquals(0, r.errors().size());
    }

    /**
     * Verifies net proceeds: row 1 = 200.00 - 20.00 = 180.00,
     * row 2 = 300.00 - 30.00 = 270.00.
     */
    @Test
    void parse_correctNetProceeds() throws Exception {
        ParseResult r = new MercariCsvParser().parse(fixture("mercari_valid.csv"));
        assertEquals(new BigDecimal("180.00"), r.rows().get(0).netProceeds());
        assertEquals(new BigDecimal("270.00"), r.rows().get(1).netProceeds());
    }

    /**
     * Verifies that a "$" prefix in price fields is stripped correctly.
     * The cancelled row has "$0.00" which should be stripped then skipped (zero price).
     */
    @Test
    void parse_dollarSignInPrice_stripped() throws Exception {
        ParseResult r = new MercariCsvParser().parse(fixture("mercari_valid.csv"));
        assertEquals(0, r.errors().size(), "dollar sign must be stripped without error");
    }

    /**
     * Verifies that a CSV missing the required "Transaction ID" header
     * returns a file-level error (rowNumber=-1) and no rows.
     */
    @Test
    void parse_missingRequiredHeader_returnsFileError() throws Exception {
        String csv = "Item,Date,Selling price,Transaction fee\nSome Item,2024-11-15,200.00,20.00\n";
        ParseResult r = new MercariCsvParser().parse(
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
        ParseResult r = new MercariCsvParser().parse(new ByteArrayInputStream(new byte[0]));
        assertTrue(r.rows().isEmpty());
        assertEquals(-1, r.errors().get(0).rowNumber());
    }

    /**
     * Verifies that a CSV with only a header row returns empty rows and no errors.
     */
    @Test
    void parse_headerOnly_returnsEmptyRowsNoErrors() throws Exception {
        String csv = "Transaction ID,Item,Date,Selling price,Transaction fee\n";
        ParseResult r = new MercariCsvParser().parse(
            new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
        assertTrue(r.rows().isEmpty());
        assertTrue(r.errors().isEmpty());
    }

    /**
     * Verifies that a blank fee cell is treated as BigDecimal.ZERO.
     */
    @Test
    void parse_blankFee_treatedAsZero() throws Exception {
        String csv = "Transaction ID,Item,Date,Selling price,Transaction fee\n"
                   + "m99999999999999,Test Item,2024-11-15,100.00,\n";
        ParseResult r = new MercariCsvParser().parse(
            new ByteArrayInputStream(csv.getBytes(StandardCharsets.UTF_8)));
        assertEquals(1, r.rows().size());
        assertEquals(new BigDecimal("100.00"), r.rows().get(0).netProceeds());
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

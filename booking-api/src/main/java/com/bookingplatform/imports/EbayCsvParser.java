package com.bookingplatform.imports;

import com.bookingplatform.imports.model.ImportError;
import com.bookingplatform.imports.model.ImportRow;
import com.bookingplatform.imports.model.ParseResult;
import com.bookingplatform.imports.model.Platform;
import com.opencsv.CSVReader;
import jakarta.enterprise.context.ApplicationScoped;
import org.apache.commons.io.input.BOMInputStream;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.apache.commons.io.ByteOrderMark.UTF_8;

/**
 * Parses eBay CSV exports into canonical {@link ImportRow} records.
 *
 * <p>eBay CSVs are UTF-8 with BOM. Date format is ISO (yyyy-MM-dd).
 * Fees are split into "Final value fee - fixed" and "Final value fee - variable",
 * which are summed to produce {@code platformFees}.
 *
 * <p>Continuation rows (blank "Order number") are skipped silently.
 */
@ApplicationScoped
public class EbayCsvParser implements CsvParser {

    private static final Set<String> REQUIRED_HEADERS = Set.of(
        "order number", "item title", "sale date",
        "unit price", "final value fee - fixed", "final value fee - variable"
    );

    /**
     * {@inheritDoc}
     */
    @Override
    public Platform getPlatform() {
        return Platform.EBAY;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public ParseResult parse(InputStream csv) {
        List<ImportRow> rows = new ArrayList<>();
        List<ImportError> errors = new ArrayList<>();

        try (BOMInputStream bomStream = BOMInputStream.builder().setInputStream(csv).setByteOrderMarks(UTF_8).get();
             CSVReader reader = new CSVReader(new InputStreamReader(bomStream, StandardCharsets.UTF_8))) {

            String[] header = reader.readNext();
            if (header == null || header.length == 0) {
                errors.add(new ImportError(-1, "file", "Empty file or no header row"));
                return new ParseResult(rows, errors);
            }

            Map<String, Integer> columnIndex = buildColumnIndex(header);

            for (String required : REQUIRED_HEADERS) {
                if (!columnIndex.containsKey(required)) {
                    errors.add(new ImportError(-1, "file",
                        "Missing required header: " + required));
                }
            }
            if (!errors.isEmpty()) {
                return new ParseResult(rows, errors);
            }

            String[] line;
            int rowNumber = 1; // header is row 1
            while ((line = reader.readNext()) != null) {
                rowNumber++;
                parseRow(line, rowNumber, columnIndex, rows, errors);
            }

        } catch (Exception e) {
            errors.add(new ImportError(-1, "file", "I/O error: " + e.getMessage()));
        }

        return new ParseResult(rows, errors);
    }

    /**
     * Parses a single CSV data row into an {@link ImportRow} or adds an error.
     *
     * @param line        the raw CSV cells
     * @param rowNumber   1-based row number
     * @param columnIndex mapping of lowercase header names to column indices
     * @param rows        accumulator for successfully parsed rows
     * @param errors      accumulator for row-level errors
     */
    private void parseRow(String[] line, int rowNumber, Map<String, Integer> columnIndex,
                          List<ImportRow> rows, List<ImportError> errors) {
        String orderId = cellValue(line, columnIndex, "order number");
        if (orderId == null || orderId.isBlank()) {
            return; // continuation row — skip silently
        }

        BigDecimal unitPrice = CsvParseUtils.parseMoney(
            cellValue(line, columnIndex, "unit price"), false);
        if (unitPrice == null) {
            errors.add(new ImportError(rowNumber, "unitPrice", "Invalid or blank unit price"));
            return;
        }

        if (unitPrice.compareTo(BigDecimal.ZERO) == 0) {
            return; // cancelled/zero-price row — skip silently
        }

        BigDecimal fixedFee = CsvParseUtils.parseMoney(
            cellValue(line, columnIndex, "final value fee - fixed"), true);
        BigDecimal variableFee = CsvParseUtils.parseMoney(
            cellValue(line, columnIndex, "final value fee - variable"), true);

        if (fixedFee == null) {
            errors.add(new ImportError(rowNumber, "fixedFee", "Invalid fixed fee"));
            return;
        }
        if (variableFee == null) {
            errors.add(new ImportError(rowNumber, "variableFee", "Invalid variable fee"));
            return;
        }

        BigDecimal platformFees = fixedFee.add(variableFee);
        BigDecimal netProceeds = unitPrice.subtract(platformFees);

        String dateStr = cellValue(line, columnIndex, "sale date");
        LocalDate saleDate;
        try {
            saleDate = LocalDate.parse(dateStr != null ? dateStr.strip() : "",
                DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            errors.add(new ImportError(rowNumber, "saleDate", "Invalid date: " + dateStr));
            return;
        }

        String title = cellValue(line, columnIndex, "item title");

        rows.add(new ImportRow(rowNumber, orderId.strip(), title != null ? title.strip() : "",
            saleDate, unitPrice, platformFees, netProceeds, false));
    }

    /**
     * Builds a case-insensitive, trimmed header-name to column-index mapping.
     *
     * @param header the raw header row from the CSV
     * @return map of lowercase trimmed header names to their column indices
     */
    private Map<String, Integer> buildColumnIndex(String[] header) {
        Map<String, Integer> index = new HashMap<>();
        for (int i = 0; i < header.length; i++) {
            index.put(header[i].strip().toLowerCase(), i);
        }
        return index;
    }

    /**
     * Safely retrieves a cell value by column name, returning null if out of bounds.
     *
     * @param line        the raw CSV cells
     * @param columnIndex the header-to-index mapping
     * @param column      the lowercase column name
     * @return the cell value, or null if the column index exceeds the line length
     */
    private String cellValue(String[] line, Map<String, Integer> columnIndex, String column) {
        Integer idx = columnIndex.get(column);
        if (idx == null || idx >= line.length) {
            return null;
        }
        return line[idx];
    }
}

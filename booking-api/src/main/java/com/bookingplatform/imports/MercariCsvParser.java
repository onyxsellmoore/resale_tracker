package com.bookingplatform.imports;

import com.bookingplatform.imports.model.ImportError;
import com.bookingplatform.imports.model.ImportRow;
import com.bookingplatform.imports.model.ParseResult;
import com.bookingplatform.imports.model.Platform;
import com.opencsv.CSVReader;
import jakarta.enterprise.context.ApplicationScoped;

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

/**
 * Parses Mercari CSV exports into canonical {@link ImportRow} records.
 *
 * <p>Mercari CSVs have no BOM. Date format is ISO (yyyy-MM-dd).
 * Fees are in a single "Transaction fee" column.
 * Cancelled/zero-price rows are skipped silently.
 */
@ApplicationScoped
public class MercariCsvParser implements CsvParser {

    private static final Set<String> REQUIRED_HEADERS = Set.of(
        "transaction id", "item", "date", "selling price", "transaction fee"
    );

    /**
     * {@inheritDoc}
     */
    @Override
    public Platform getPlatform() {
        return Platform.MERCARI;
    }

    /**
     * {@inheritDoc}
     */
    @Override
    public ParseResult parse(InputStream csv) {
        List<ImportRow> rows = new ArrayList<>();
        List<ImportError> errors = new ArrayList<>();

        try (CSVReader reader = new CSVReader(
                new InputStreamReader(csv, StandardCharsets.UTF_8))) {

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
     * Parses a single Mercari CSV data row into an {@link ImportRow} or adds an error.
     *
     * @param line        the raw CSV cells
     * @param rowNumber   1-based row number
     * @param columnIndex mapping of lowercase header names to column indices
     * @param rows        accumulator for successfully parsed rows
     * @param errors      accumulator for row-level errors
     */
    private void parseRow(String[] line, int rowNumber, Map<String, Integer> columnIndex,
                          List<ImportRow> rows, List<ImportError> errors) {
        String transactionId = cellValue(line, columnIndex, "transaction id");
        if (transactionId == null || transactionId.isBlank()) {
            return; // skip rows with blank transaction ID
        }

        BigDecimal sellingPrice = CsvParseUtils.parseMoney(
            cellValue(line, columnIndex, "selling price"), false);
        if (sellingPrice == null) {
            errors.add(new ImportError(rowNumber, "sellingPrice", "Invalid or blank selling price"));
            return;
        }

        if (sellingPrice.compareTo(BigDecimal.ZERO) == 0) {
            return; // cancelled/zero-price row — skip silently
        }

        BigDecimal transactionFee = CsvParseUtils.parseMoney(
            cellValue(line, columnIndex, "transaction fee"), true);
        if (transactionFee == null) {
            errors.add(new ImportError(rowNumber, "transactionFee", "Invalid transaction fee"));
            return;
        }

        BigDecimal netProceeds = sellingPrice.subtract(transactionFee);

        String dateStr = cellValue(line, columnIndex, "date");
        LocalDate saleDate;
        try {
            saleDate = LocalDate.parse(dateStr != null ? dateStr.strip() : "",
                DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            errors.add(new ImportError(rowNumber, "saleDate", "Invalid date: " + dateStr));
            return;
        }

        String title = cellValue(line, columnIndex, "item");

        rows.add(new ImportRow(rowNumber, transactionId.strip(), title != null ? title.strip() : "",
            saleDate, sellingPrice, transactionFee, netProceeds, false));
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

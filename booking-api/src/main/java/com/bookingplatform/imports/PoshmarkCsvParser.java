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
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Parses Poshmark CSV exports into canonical {@link ImportRow} records.
 *
 * <p>Poshmark CSVs have no BOM. Date format is "MMM d yyyy" (e.g. "Nov 15 2024").
 * Fees are in a single "Fees" column. Cancelled/zero-price rows are skipped silently.
 */
@ApplicationScoped
public class PoshmarkCsvParser implements CsvParser {

    private static final Set<String> REQUIRED_HEADERS = Set.of(
        "order", "title", "date", "price", "fees"
    );

    private static final DateTimeFormatter DATE_FORMAT =
        DateTimeFormatter.ofPattern("MMM d yyyy", Locale.ENGLISH);

    /**
     * {@inheritDoc}
     */
    @Override
    public Platform getPlatform() {
        return Platform.POSHMARK;
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
     * Parses a single Poshmark CSV data row into an {@link ImportRow} or adds an error.
     *
     * @param line        the raw CSV cells
     * @param rowNumber   1-based row number
     * @param columnIndex mapping of lowercase header names to column indices
     * @param rows        accumulator for successfully parsed rows
     * @param errors      accumulator for row-level errors
     */
    private void parseRow(String[] line, int rowNumber, Map<String, Integer> columnIndex,
                          List<ImportRow> rows, List<ImportError> errors) {
        String orderId = cellValue(line, columnIndex, "order");
        if (orderId == null || orderId.isBlank()) {
            return; // skip rows with blank order ID
        }

        BigDecimal price = CsvParseUtils.parseMoney(
            cellValue(line, columnIndex, "price"), false);
        if (price == null) {
            errors.add(new ImportError(rowNumber, "price", "Invalid or blank price"));
            return;
        }

        if (price.compareTo(BigDecimal.ZERO) == 0) {
            return; // cancelled/zero-price row — skip silently
        }

        BigDecimal fees = CsvParseUtils.parseMoney(
            cellValue(line, columnIndex, "fees"), true);
        if (fees == null) {
            errors.add(new ImportError(rowNumber, "fees", "Invalid fees"));
            return;
        }

        BigDecimal netProceeds = price.subtract(fees);

        String dateStr = cellValue(line, columnIndex, "date");
        LocalDate saleDate;
        try {
            String normalized = dateStr != null
                ? dateStr.strip().replaceAll("\\s+", " ")
                : "";
            saleDate = LocalDate.parse(normalized, DATE_FORMAT);
        } catch (DateTimeParseException e) {
            errors.add(new ImportError(rowNumber, "saleDate", "Invalid date: " + dateStr));
            return;
        }

        String title = cellValue(line, columnIndex, "title");

        rows.add(new ImportRow(rowNumber, orderId.strip(), title != null ? title.strip() : "",
            saleDate, price, fees, netProceeds, false));
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

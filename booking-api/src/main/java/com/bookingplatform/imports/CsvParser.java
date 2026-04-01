package com.bookingplatform.imports;

import com.bookingplatform.imports.model.ParseResult;
import com.bookingplatform.imports.model.Platform;

import java.io.InputStream;

/**
 * Parses a platform CSV export into a canonical {@link ParseResult}.
 *
 * <p>Contract:
 * <ul>
 *   <li>Never throws; collect ALL errors into {@code ParseResult.errors}.</li>
 *   <li>File-level errors: rowNumber=-1, field="file".</li>
 *   <li>Row-level errors: 1-based row number (header = row 1, first data row = row 2).</li>
 *   <li>Headers matched case-insensitively with whitespace trimming.</li>
 *   <li>Unknown/extra columns silently ignored.</li>
 *   <li>Price cells: strip leading/trailing whitespace, strip "$" and ",", then parse.</li>
 *   <li>Whitespace-only price cells treated same as blank (produce a row error).</li>
 *   <li>Blank fee cells (not price cells) treated as {@code BigDecimal.ZERO} (not an error).</li>
 *   <li>Cancelled/zero-price rows skipped silently (no error).</li>
 *   <li>Implementations must be {@code @ApplicationScoped} CDI beans.</li>
 * </ul>
 */
public interface CsvParser {

    /**
     * Parses the given CSV input stream into rows and errors.
     *
     * @param csv the CSV content to parse
     * @return a {@link ParseResult} containing parsed rows and any errors
     */
    ParseResult parse(InputStream csv);

    /**
     * Returns the platform this parser handles.
     *
     * @return the {@link Platform} enum value
     */
    Platform getPlatform();
}

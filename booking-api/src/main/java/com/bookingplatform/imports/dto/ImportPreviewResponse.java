package com.bookingplatform.imports.dto;

import java.util.List;

/**
 * Response from the import preview endpoint.
 *
 * @param platform      the platform that was parsed
 * @param totalRows     total rows found in the CSV (valid + error)
 * @param validRows     number of rows that passed validation
 * @param duplicateRows number of rows already imported for this business+platform
 * @param errorRows     number of rows that had parse/validation errors
 * @param rowLimit      maximum rows allowed per import (always 2000)
 * @param rows          successfully parsed rows with duplicate flags
 * @param errors        all parse/validation errors encountered
 */
public record ImportPreviewResponse(
    String platform,
    int totalRows,
    int validRows,
    int duplicateRows,
    int errorRows,
    int rowLimit,
    List<ImportRowDto> rows,
    List<ImportErrorDto> errors
) {}

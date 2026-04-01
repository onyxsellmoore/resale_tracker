package com.bookingplatform.imports.model;

import java.util.List;

/**
 * Output of {@link com.bookingplatform.imports.CsvParser#parse(java.io.InputStream)}.
 * rows contains all successfully parsed rows; errors contains all problems found.
 * Non-empty errors does not mean rows is empty — partial results are expected.
 *
 * @param rows   successfully parsed import rows
 * @param errors all parse/validation errors encountered
 */
public record ParseResult(List<ImportRow> rows, List<ImportError> errors) {}

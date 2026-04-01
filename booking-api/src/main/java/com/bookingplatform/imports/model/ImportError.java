package com.bookingplatform.imports.model;

/**
 * A parse or validation error from CSV import.
 * rowNumber = -1 signals a file-level error (missing header, I/O failure, empty file).
 *
 * @param rowNumber 1-based row number, or -1 for file-level errors
 * @param field     the field that caused the error (e.g. "unitPrice", "file")
 * @param message   human-readable error description
 */
public record ImportError(int rowNumber, String field, String message) {}

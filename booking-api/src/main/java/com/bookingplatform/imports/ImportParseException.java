package com.bookingplatform.imports;

/**
 * Thrown when a CSV file cannot be parsed at all (missing required headers, I/O error).
 * Row-level errors are collected into ParseResult.errors instead.
 */
public class ImportParseException extends RuntimeException {

    public ImportParseException(String message) {
        super(message);
    }

    public ImportParseException(String message, Throwable cause) {
        super(message, cause);
    }
}

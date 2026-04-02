package com.bookingplatform.imports.dto;

/**
 * DTO representing a single import error returned to the client.
 *
 * @param rowNumber 1-based row number, or -1 for file-level errors
 * @param field     the field that caused the error
 * @param message   human-readable error description
 */
public record ImportErrorDto(int rowNumber, String field, String message) {}

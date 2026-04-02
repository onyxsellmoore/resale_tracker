package com.bookingplatform.imports.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO representing a single import row in preview/confirm payloads.
 *
 * @param rowNumber       1-based row number from the CSV
 * @param externalOrderId platform-specific order identifier
 * @param title           item title from the CSV
 * @param saleDate        date of the sale
 * @param salePrice       gross sale price before fees
 * @param platformFees    total platform fees deducted
 * @param netProceeds     salePrice minus platformFees (server-recomputed on confirm)
 * @param isDuplicate     true if this order already exists for the business+platform
 */
public record ImportRowDto(
    int rowNumber,
    String externalOrderId,
    String title,
    LocalDate saleDate,
    BigDecimal salePrice,
    BigDecimal platformFees,
    BigDecimal netProceeds,
    boolean isDuplicate
) {}

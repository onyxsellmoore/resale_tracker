package com.bookingplatform.imports.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * One parsed platform sale row in canonical form.
 * netProceeds is computed by the parser as salePrice - platformFees.
 * isDuplicate is set by ImportService during preview; parsers always set it false.
 *
 * @param rowNumber       1-based row number from the CSV (header = row 1)
 * @param externalOrderId platform-specific order identifier
 * @param title           item title from the CSV
 * @param saleDate        date of the sale
 * @param salePrice       gross sale price before fees
 * @param platformFees    total platform fees deducted
 * @param netProceeds     salePrice minus platformFees
 * @param isDuplicate     false from parser; set true by ImportService if already imported
 */
public record ImportRow(
    int rowNumber,
    String externalOrderId,
    String title,
    LocalDate saleDate,
    BigDecimal salePrice,
    BigDecimal platformFees,
    BigDecimal netProceeds,
    boolean isDuplicate
) {}

package com.bookingplatform.imports.dto;

/**
 * Response from the import confirm endpoint.
 *
 * @param imported              number of items+sales successfully created
 * @param skippedDuplicates     number of rows skipped because they already exist
 * @param itemsNeedingCostReview count of newly imported items with costEntryPending=true
 *                               (equals imported, since every imported item has purchasePrice=$0)
 * @param batchErrors           count of rows that failed validation or database insert
 */
public record ImportResultResponse(
    int imported,
    int skippedDuplicates,
    int itemsNeedingCostReview,
    int batchErrors
) {}

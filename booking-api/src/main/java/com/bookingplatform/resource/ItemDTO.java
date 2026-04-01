package com.bookingplatform.resource;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemCondition;
import com.bookingplatform.model.ItemStatus;

import java.math.BigDecimal;
import java.time.Instant;

public record ItemDTO(
        String id,
        String businessId,
        String name,
        String brand,
        String category,
        ItemCondition condition,
        BigDecimal purchasePrice,
        Instant purchaseDate,
        String description,
        String notes,
        ItemStatus status,
        boolean costEntryPending,
        Instant createdAt,
        Instant updatedAt
) {
    public static ItemDTO from(Item item) {
        return new ItemDTO(
                item.id.toHexString(),
                item.businessId,
                item.name,
                item.brand,
                item.category,
                item.condition,
                item.purchasePrice != null ? item.purchasePrice.bigDecimalValue() : null,
                item.purchaseDate,
                item.description,
                item.notes,
                item.status,
                item.costEntryPending,
                item.createdAt,
                item.updatedAt
        );
    }
}

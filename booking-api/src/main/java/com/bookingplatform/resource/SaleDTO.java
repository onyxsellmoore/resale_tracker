package com.bookingplatform.resource;

import com.bookingplatform.model.Sale;

import java.math.BigDecimal;
import java.time.Instant;

public record SaleDTO(
        String id,
        String businessId,
        String itemId,
        String itemName,
        String itemBrand,
        String platform,
        BigDecimal salePrice,
        BigDecimal platformFees,
        BigDecimal netProceeds,
        BigDecimal profit,
        Instant soldAt,
        String notes,
        Instant createdAt
) {
    public static SaleDTO from(Sale sale, String itemName, String itemBrand) {
        return new SaleDTO(
                sale.id.toHexString(),
                sale.businessId,
                sale.itemId,
                itemName,
                itemBrand,
                sale.platform,
                sale.salePrice != null ? sale.salePrice.bigDecimalValue() : null,
                sale.platformFees != null ? sale.platformFees.bigDecimalValue() : null,
                sale.netProceeds != null ? sale.netProceeds.bigDecimalValue() : null,
                sale.profit != null ? sale.profit.bigDecimalValue() : null,
                sale.soldAt,
                sale.notes,
                sale.createdAt
        );
    }
}

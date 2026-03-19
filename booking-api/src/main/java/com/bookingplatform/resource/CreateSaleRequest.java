package com.bookingplatform.resource;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;

public class CreateSaleRequest {

    // businessId is now extracted from JWT (orgId claim). Keep field for backward compat but not required.
    public String businessId;

    @NotBlank(message = "itemId is required")
    public String itemId;

    @NotBlank(message = "platform is required")
    public String platform;

    @NotNull(message = "salePrice is required")
    @DecimalMin(value = "0.01", message = "salePrice must be > 0")
    public BigDecimal salePrice;

    @NotNull(message = "platformFees is required")
    @DecimalMin(value = "0.00", message = "platformFees must be >= 0")
    public BigDecimal platformFees;

    @NotNull(message = "soldAt is required")
    public Instant soldAt;

    public String platformOrderId;

    public String notes;
}

package com.bookingplatform.resource;

import com.bookingplatform.model.ItemCondition;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.Instant;

public class CreateItemRequest {

    // businessId is now extracted from JWT (orgId claim). Keep field for backward compat but not required.
    public String businessId;

    @NotBlank(message = "name is required")
    public String name;

    public String brand;
    public String category;

    @NotNull(message = "condition is required")
    public ItemCondition condition;

    @NotNull(message = "purchasePrice is required")
    @DecimalMin(value = "0.00", message = "purchasePrice must be >= 0")
    public BigDecimal purchasePrice;

    @NotNull(message = "purchaseDate is required")
    public Instant purchaseDate;

    public String description;
    public String notes;
}

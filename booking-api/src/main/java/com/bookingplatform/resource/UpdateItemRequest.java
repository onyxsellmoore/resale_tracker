package com.bookingplatform.resource;

import com.bookingplatform.model.ItemCondition;

import java.math.BigDecimal;
import java.time.Instant;

public class UpdateItemRequest {

    // businessId is now extracted from JWT (orgId claim)
    public String businessId;

    public String name;
    public String brand;
    public String category;
    public ItemCondition condition;
    public BigDecimal purchasePrice;
    public Instant purchaseDate;
    public String description;
    public String notes;
}

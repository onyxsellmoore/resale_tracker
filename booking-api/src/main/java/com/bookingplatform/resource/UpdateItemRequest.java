package com.bookingplatform.resource;

import com.bookingplatform.model.ItemCondition;
import jakarta.validation.constraints.NotBlank;

public class UpdateItemRequest {

    // businessId is now extracted from JWT (orgId claim)
    public String businessId;

    public String name;
    public String brand;
    public String category;
    public ItemCondition condition;
    public String description;
    public String notes;
}

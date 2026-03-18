package com.bookingplatform.model;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.types.Decimal128;

import java.time.Instant;

@MongoEntity(collection = "items")
public class Item extends PanacheMongoEntity {

    public String businessId;
    public String name;
    public String brand;
    public String category;
    public ItemCondition condition;
    public Decimal128 purchasePrice;
    public Instant purchaseDate;
    public String description;
    public String notes;
    public ItemStatus status;
    public Instant createdAt;
    public Instant updatedAt;
}

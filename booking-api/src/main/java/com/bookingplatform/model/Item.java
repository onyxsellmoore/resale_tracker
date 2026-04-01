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

    /**
     * True for imported items whose purchasePrice has not been confirmed by the user.
     * purchasePrice defaults to $0.00 on import, making profit visible immediately (as an
     * estimate). After the user's first PATCH setting purchasePrice and purchaseDate,
     * costEntryPending is set to false and both fields become permanently immutable.
     */
    public boolean costEntryPending = false;

    public Instant createdAt;
    public Instant updatedAt;
}

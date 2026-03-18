package com.bookingplatform.model;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.types.Decimal128;

import java.time.Instant;

@MongoEntity(collection = "sales")
public class Sale extends PanacheMongoEntity {

    public String businessId;
    public String itemId;
    public String platform;
    public Decimal128 salePrice;
    public Decimal128 platformFees;
    public Decimal128 netProceeds;
    public Decimal128 profit;
    public Instant soldAt;
    public String notes;
    public Instant createdAt;
}

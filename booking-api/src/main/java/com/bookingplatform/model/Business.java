package com.bookingplatform.model;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;

import java.time.Instant;

@MongoEntity(collection = "businesses")
public class Business extends PanacheMongoEntity {

    public String name;
    public String timezone;
    public String plan;
    public boolean active;
    public Instant createdAt;
}

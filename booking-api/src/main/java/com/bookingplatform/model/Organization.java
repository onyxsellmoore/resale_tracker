package com.bookingplatform.model;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;

import java.time.Instant;

@MongoEntity(collection = "organizations")
public class Organization extends PanacheMongoEntity {

    public String name;
    public String slug;
    public Instant createdAt;
}

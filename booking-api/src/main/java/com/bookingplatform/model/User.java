package com.bookingplatform.model;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;
import org.bson.types.ObjectId;

import java.time.Instant;

@MongoEntity(collection = "users")
public class User extends PanacheMongoEntity {

    public ObjectId orgId;
    public String email;
    public String displayName;
    public Role role;
    public Instant createdAt;
}

package com.bookingplatform.model;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;

import java.time.Instant;

@MongoEntity(collection = "refresh_tokens")
public class RefreshToken extends PanacheMongoEntity {

    public String tokenHash;    // SHA-256 hash of the opaque token
    public String ownerId;
    public String businessId;
    public Instant expiresAt;
    public boolean revoked;
    public Instant createdAt;
}

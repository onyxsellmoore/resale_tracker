package com.bookingplatform.model;

import io.quarkus.mongodb.panache.PanacheMongoEntity;
import io.quarkus.mongodb.panache.common.MongoEntity;

import java.time.Instant;

@MongoEntity(collection = "webauthn_credentials")
public class WebAuthnCredential extends PanacheMongoEntity {

    public String ownerId;
    public String credentialId;   // base64url-encoded
    public String publicKey;      // base64url-encoded COSE key
    public long signCount;
    public Instant createdAt;
}

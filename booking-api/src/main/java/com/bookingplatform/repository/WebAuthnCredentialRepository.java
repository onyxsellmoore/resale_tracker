package com.bookingplatform.repository;

import com.bookingplatform.model.WebAuthnCredential;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.List;
import java.util.Optional;

@ApplicationScoped
public class WebAuthnCredentialRepository implements PanacheMongoRepository<WebAuthnCredential> {

    public List<WebAuthnCredential> findByOwnerId(String ownerId) {
        return list("ownerId", ownerId);
    }

    public Optional<WebAuthnCredential> findByCredentialId(String credentialId) {
        return find("credentialId", credentialId).firstResultOptional();
    }
}

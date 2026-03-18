package com.bookingplatform.repository;

import com.bookingplatform.model.RefreshToken;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

@ApplicationScoped
public class RefreshTokenRepository implements PanacheMongoRepository<RefreshToken> {

    public Optional<RefreshToken> findByTokenHash(String tokenHash) {
        return find("tokenHash", tokenHash).firstResultOptional();
    }
}

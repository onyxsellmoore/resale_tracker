package com.bookingplatform.repository;

import com.bookingplatform.model.Organization;
import io.quarkus.mongodb.panache.PanacheMongoRepository;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.Optional;

@ApplicationScoped
public class OrganizationRepository implements PanacheMongoRepository<Organization> {

    public Optional<Organization> findBySlug(String slug) {
        return find("slug", slug).firstResultOptional();
    }
}

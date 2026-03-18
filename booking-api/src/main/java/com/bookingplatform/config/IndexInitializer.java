package com.bookingplatform.config;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoDatabase;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class IndexInitializer {

    @Inject
    MongoClient mongoClient;

    @ConfigProperty(name = "quarkus.mongodb.database")
    String databaseName;

    @ConfigProperty(name = "booking.indexes.enabled", defaultValue = "true")
    boolean indexesEnabled;

    private static final java.util.logging.Logger LOG =
            java.util.logging.Logger.getLogger(IndexInitializer.class.getName());

    void onStart(@Observes StartupEvent ev) {
        if (!indexesEnabled) {
            return;
        }
        try {
            MongoDatabase db = mongoClient.getDatabase(databaseName);

            // Item indexes
            db.getCollection("items").createIndex(
                    Indexes.compoundIndex(Indexes.ascending("businessId"), Indexes.ascending("status")));
            db.getCollection("items").createIndex(
                    Indexes.compoundIndex(Indexes.ascending("businessId"), Indexes.ascending("brand")));

            // Sale indexes
            db.getCollection("sales").createIndex(
                    Indexes.compoundIndex(Indexes.ascending("businessId"), Indexes.descending("soldAt")));
            db.getCollection("sales").createIndex(
                    Indexes.compoundIndex(Indexes.ascending("businessId"), Indexes.ascending("itemId")));

            // User indexes
            db.getCollection("users").createIndex(
                    Indexes.ascending("email"), new IndexOptions().unique(true));
            db.getCollection("users").createIndex(
                    Indexes.ascending("orgId"));

            // Organization indexes
            db.getCollection("organizations").createIndex(
                    Indexes.ascending("slug"), new IndexOptions().unique(true));

            // WebAuthn credential indexes
            db.getCollection("webauthn_credentials").createIndex(
                    Indexes.ascending("ownerId"));
            db.getCollection("webauthn_credentials").createIndex(
                    Indexes.ascending("credentialId"), new IndexOptions().unique(true));

            // Refresh token indexes
            db.getCollection("refresh_tokens").createIndex(
                    Indexes.ascending("tokenHash"), new IndexOptions().unique(true));
            db.getCollection("refresh_tokens").createIndex(
                    Indexes.ascending("expiresAt"),
                    new IndexOptions().expireAfter(0L, java.util.concurrent.TimeUnit.SECONDS));

            LOG.info("MongoDB indexes created successfully");
        } catch (Exception e) {
            LOG.warning("Could not create MongoDB indexes on startup: " + e.getMessage()
                    + ". Indexes will be created when MongoDB becomes available.");
        }
    }
}

package com.bookingplatform.repository;

import com.bookingplatform.model.Organization;
import com.mongodb.MongoWriteException;
import com.mongodb.client.MongoClient;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.Indexes;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.mongodb.MongoTestResource;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
class OrganizationRepositoryTest {

    @Inject
    OrganizationRepository organizationRepository;

    @Inject
    MongoClient mongoClient;

    @ConfigProperty(name = "quarkus.mongodb.database")
    String databaseName;

    @BeforeEach
    void setUp() {
        organizationRepository.deleteAll();
        // Ensure unique index on slug for test
        mongoClient.getDatabase(databaseName)
                .getCollection("organizations")
                .createIndex(Indexes.ascending("slug"), new IndexOptions().unique(true));
    }

    @Test
    void canPersistAndFindOrganizationBySlug() {
        Organization org = new Organization();
        org.name = "Test Org";
        org.slug = "test-org";
        org.createdAt = Instant.now();
        organizationRepository.persist(org);

        Optional<Organization> found = organizationRepository.findBySlug("test-org");
        assertTrue(found.isPresent());
        assertEquals("Test Org", found.get().name);
        assertEquals("test-org", found.get().slug);
        assertNotNull(found.get().id);
    }

    @Test
    void findBySlugReturnsEmptyWhenNotFound() {
        Optional<Organization> found = organizationRepository.findBySlug("nonexistent");
        assertTrue(found.isEmpty());
    }

    @Test
    void slugIsUniqueIndex() {
        Organization org1 = new Organization();
        org1.name = "Org One";
        org1.slug = "unique-slug";
        org1.createdAt = Instant.now();
        organizationRepository.persist(org1);

        Organization org2 = new Organization();
        org2.name = "Org Two";
        org2.slug = "unique-slug";
        org2.createdAt = Instant.now();

        assertThrows(MongoWriteException.class, () -> organizationRepository.persist(org2));
    }
}

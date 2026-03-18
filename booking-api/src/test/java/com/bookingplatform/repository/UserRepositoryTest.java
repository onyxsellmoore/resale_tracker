package com.bookingplatform.repository;

import com.bookingplatform.model.Role;
import com.bookingplatform.model.User;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.mongodb.MongoTestResource;
import jakarta.inject.Inject;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
class UserRepositoryTest {

    @Inject
    UserRepository userRepository;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
    }

    @Test
    void canPersistAndFindUserByEmail() {
        ObjectId orgId = new ObjectId();
        User user = new User();
        user.orgId = orgId;
        user.email = "admin@example.com";
        user.displayName = "Admin User";
        user.role = Role.ADMIN;
        user.createdAt = Instant.now();
        userRepository.persist(user);

        Optional<User> found = userRepository.findByEmail("admin@example.com");
        assertTrue(found.isPresent());
        assertEquals("Admin User", found.get().displayName);
        assertEquals(Role.ADMIN, found.get().role);
        assertEquals(orgId, found.get().orgId);
    }

    @Test
    void findByEmailReturnsEmptyWhenNotFound() {
        Optional<User> found = userRepository.findByEmail("nobody@example.com");
        assertTrue(found.isEmpty());
    }
}

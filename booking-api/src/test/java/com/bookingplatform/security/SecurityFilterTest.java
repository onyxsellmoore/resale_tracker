package com.bookingplatform.security;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemCondition;
import com.bookingplatform.model.ItemStatus;
import com.bookingplatform.model.Role;
import com.bookingplatform.model.User;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.RefreshTokenRepository;
import com.bookingplatform.repository.UserRepository;
import com.bookingplatform.repository.WebAuthnCredentialRepository;
import com.bookingplatform.service.AuthService;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.mongodb.MongoTestResource;
import jakarta.inject.Inject;
import org.bson.types.Decimal128;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
@TestProfile(SecurityEnabledProfile.class)
@DisplayName("Security filter")
class SecurityFilterTest {

    @Inject UserRepository userRepository;
    @Inject WebAuthnCredentialRepository credentialRepository;
    @Inject RefreshTokenRepository refreshTokenRepository;
    @Inject ItemRepository itemRepository;
    @Inject AuthService authService;

    private User testUser;
    private ObjectId testOrgId;

    @BeforeEach
    void setUp() {
        refreshTokenRepository.deleteAll();
        credentialRepository.deleteAll();
        itemRepository.deleteAll();
        userRepository.deleteAll();

        testOrgId = new ObjectId();

        testUser = new User();
        testUser.orgId = testOrgId;
        testUser.email = "owner@test.com";
        testUser.displayName = "Test Owner";
        testUser.role = Role.ADMIN;
        testUser.createdAt = Instant.now();
        userRepository.persist(testUser);

        Item item = new Item();
        item.businessId = testOrgId.toHexString();
        item.name = "Test Item";
        item.brand = "TestBrand";
        item.category = "TestCat";
        item.condition = ItemCondition.GOOD;
        item.purchasePrice = new Decimal128(new BigDecimal("50.00"));
        item.purchaseDate = Instant.now();
        item.status = ItemStatus.AVAILABLE;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();
        itemRepository.persist(item);
    }

    @Nested @DisplayName("token validation")
    class TokenValidation {

        @Test @DisplayName("no token → 401")
        void noToken() {
            given()
                .when()
                .get("/api/v1/items")
                .then()
                .statusCode(401);
        }

        @Test @DisplayName("valid token, matching business → 200")
        void validTokenMatchingBusiness() {
            AuthService.TokenPair tokens = authService.generateTokens(testUser);

            given()
                .header("Authorization", "Bearer " + tokens.accessToken())
                .when()
                .get("/api/v1/items")
                .then()
                .statusCode(200)
                .body("$.size()", greaterThanOrEqualTo(1));
        }

        @Test @DisplayName("valid token, wrong businessId param → 403")
        void validTokenWrongBusiness() {
            AuthService.TokenPair tokens = authService.generateTokens(testUser);

            given()
                .header("Authorization", "Bearer " + tokens.accessToken())
                .queryParam("businessId", "biz-other")
                .when()
                .get("/api/v1/items")
                .then()
                .statusCode(403);
        }
    }

    @Nested @DisplayName("public endpoints bypass filter")
    class PublicEndpoints {

        @Test @DisplayName("POST /api/v1/auth/register → no token needed")
        void authRegisterPublic() {
            given()
                .contentType("application/json")
                .body("""
                    {
                        "orgName": "Public Test",
                        "orgSlug": "public-test",
                        "adminEmail": "pub@test.com",
                        "adminDisplayName": "Pub"
                    }
                    """)
                .when()
                .post("/api/v1/auth/register")
                .then()
                .statusCode(201);
        }

        @Test @DisplayName("GET /q/health → no token needed")
        void healthPublic() {
            given()
                .when()
                .get("/q/health")
                .then()
                .statusCode(200);
        }
    }
}

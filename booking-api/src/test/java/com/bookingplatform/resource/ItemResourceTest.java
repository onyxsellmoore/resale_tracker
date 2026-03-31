package com.bookingplatform.resource;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.ItemCondition;
import com.bookingplatform.model.ItemStatus;
import com.bookingplatform.model.User;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.OrganizationRepository;
import com.bookingplatform.repository.SaleRepository;
import com.bookingplatform.repository.UserRepository;
import com.bookingplatform.security.SecurityEnabledProfile;
import com.bookingplatform.service.AuthService;
import com.mongodb.client.MongoClient;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.mongodb.MongoTestResource;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.bson.Document;
import org.bson.types.Decimal128;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Date;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
@TestProfile(SecurityEnabledProfile.class)
@DisplayName("Item API")
class ItemResourceTest {

    @Inject
    ItemRepository itemRepository;
    @Inject
    SaleRepository saleRepository;
    @Inject
    OrganizationRepository organizationRepository;
    @Inject
    UserRepository userRepository;
    @Inject
    AuthService authService;
    @Inject
    MongoClient mongoClient;
    @ConfigProperty(name = "quarkus.mongodb.database")
    String databaseName;

    private String adminToken;
    private String orgId;

    @BeforeEach
    void setUp() {
        saleRepository.deleteAll();
        itemRepository.deleteAll();
        userRepository.deleteAll();
        organizationRepository.deleteAll();

        // Register org and get admin token (Pattern D)
        given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                            "orgName": "Item Test Org",
                            "orgSlug": "item-test",
                            "adminEmail": "admin@item-test.com",
                            "adminDisplayName": "Admin"
                        }
                        """)
                .when()
                .post("/api/v1/auth/register")
                .then()
                .statusCode(201);

        User admin = userRepository.findByEmail("admin@item-test.com").orElseThrow();
        adminToken = authService.generateUserJwt(admin);
        orgId = admin.orgId.toHexString();
    }

    @Nested
    @DisplayName("POST /items")
    class Create {

        @Test
        @DisplayName("valid item → 201 with id and all fields")
        void validItem() {
            given()
                    .contentType(ContentType.JSON)
                    .header("Authorization", "Bearer " + adminToken)
                    .body("""
                            {
                                "name": "Gucci Marmont Bag",
                                "brand": "Gucci",
                                "category": "Handbags",
                                "condition": "EXCELLENT",
                                "purchasePrice": 250.00,
                                "purchaseDate": "2025-01-15T00:00:00Z",
                                "description": "Vintage leather",
                                "notes": "Slight patina"
                            }
                            """)
                    .when()
                    .post("/api/v1/items")
                    .then()
                    .statusCode(201)
                    .body("id", notNullValue())
                    .body("name", equalTo("Gucci Marmont Bag"))
                    .body("brand", equalTo("Gucci"))
                    .body("category", equalTo("Handbags"))
                    .body("condition", equalTo("EXCELLENT"))
                    .body("purchasePrice", equalTo(250.00f))
                    .body("status", equalTo("AVAILABLE"))
                    .body("description", equalTo("Vintage leather"))
                    .body("notes", equalTo("Slight patina"));
        }

        @Test
        @DisplayName("missing name → 400")
        void missingName() {
            given()
                    .contentType(ContentType.JSON)
                    .header("Authorization", "Bearer " + adminToken)
                    .body("""
                            {
                                "brand": "Gucci",
                                "condition": "GOOD",
                                "purchasePrice": 100.00,
                                "purchaseDate": "2025-01-15T00:00:00Z"
                            }
                            """)
                    .when()
                    .post("/api/v1/items")
                    .then()
                    .statusCode(400);
        }

        @Test
        @DisplayName("condition NEW → 201")
        void conditionNew() {
            given()
                    .contentType(ContentType.JSON)
                    .header("Authorization", "Bearer " + adminToken)
                    .body("""
                            {
                                "name": "Brand New Bag",
                                "condition": "NEW",
                                "purchasePrice": 300.00,
                                "purchaseDate": "2025-01-15T00:00:00Z"
                            }
                            """)
                    .when()
                    .post("/api/v1/items")
                    .then()
                    .statusCode(201)
                    .body("condition", equalTo("NEW"));
        }

        @Test
        @DisplayName("negative purchasePrice → 400")
        void negativePurchasePrice() {
            given()
                    .contentType(ContentType.JSON)
                    .header("Authorization", "Bearer " + adminToken)
                    .body("""
                            {
                                "name": "Bad Item",
                                "condition": "FAIR",
                                "purchasePrice": -10.00,
                                "purchaseDate": "2025-01-15T00:00:00Z"
                            }
                            """)
                    .when()
                    .post("/api/v1/items")
                    .then()
                    .statusCode(400);
        }
    }

    @Nested
    @DisplayName("GET /items")
    class List {

        @Test
        @DisplayName("only returns items for the requesting org")
        void onlyOrgItems() {
            createTestItem(orgId, "Item A", ItemStatus.AVAILABLE);
            createTestItem("other-biz", "Item B", ItemStatus.AVAILABLE);
            createTestItem(orgId, "Item C", ItemStatus.AVAILABLE);

            given()
                    .header("Authorization", "Bearer " + adminToken)
                    .when()
                    .get("/api/v1/items")
                    .then()
                    .statusCode(200)
                    .body("size()", equalTo(2))
                    .body("name", hasItems("Item A", "Item C"))
                    .body("name", not(hasItem("Item B")));
        }

        @Test
        @DisplayName("?status=AVAILABLE excludes SOLD items")
        void statusFilterExcludesSold() {
            createTestItem(orgId, "Available Item", ItemStatus.AVAILABLE);
            createTestItem(orgId, "Sold Item", ItemStatus.SOLD);

            given()
                    .header("Authorization", "Bearer " + adminToken)
                    .queryParam("status", "AVAILABLE")
                    .when()
                    .get("/api/v1/items")
                    .then()
                    .statusCode(200)
                    .body("size()", equalTo(1))
                    .body("[0].name", equalTo("Available Item"));
        }

        @Nested
        @DisplayName("GET /items/:id")
        class GetById {

            @Test
            @DisplayName("correct org → 200")
            void correctOrg() {
                Item item = createTestItem(orgId, "My Item", ItemStatus.AVAILABLE);

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .get("/api/v1/items/{id}", item.id.toHexString())
                        .then()
                        .statusCode(200)
                        .body("name", equalTo("My Item"));
            }

            @Test
            @DisplayName("item from other org → 404")
            void otherOrg() {
                Item item = createTestItem("other-biz", "Other Item", ItemStatus.AVAILABLE);

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .get("/api/v1/items/{id}", item.id.toHexString())
                        .then()
                        .statusCode(404);
            }
        }

        @Nested
        @DisplayName("PATCH /items/:id")
        class Update {

            @Test
            @DisplayName("updates name and condition, purchasePrice unchanged")
            void updatesAllowedFields() {
                Item item = createTestItem(orgId, "Original Name", ItemStatus.AVAILABLE);
                BigDecimal originalPrice = item.purchasePrice.bigDecimalValue();

                given()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + adminToken)
                        .body("""
                                
                                            {
                                    "name": "Updated Name",
                                    "condition": "FAIR"
                                }
                                """)
                        .when()
                        .patch("/api/v1/items/{id}", item.id.toHexString())
                        .then()
                        .statusCode(200)
                        .body("name", equalTo("Updated Name"))
                        .body("condition", equalTo("FAIR"))
                        .body("purchasePrice", equalTo(originalPrice.floatValue()));
            }
        }

        @Nested
        @DisplayName("immutable fields")
        class ImmutableFields {

            @Test
            @DisplayName("PATCH with purchasePrice → 400 (immutable)")
            void purchasePriceImmutable() {
                Item item = createTestItem(orgId, "Test Item", ItemStatus.AVAILABLE);

                given()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + adminToken)
                        .body("""
                                {
                                    "purchasePrice": 9999.99
                                }
                                """)
                        .when()
                        .patch("/api/v1/items/{id}", item.id.toHexString())
                        .then()
                        .statusCode(400);
            }

            @Test
            @DisplayName("PATCH with purchaseDate → 400 (immutable)")
            void purchaseDateImmutable() {
                Item item = createTestItem(orgId, "Test Item", ItemStatus.AVAILABLE);

                given()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + adminToken)
                        .body("""
                                {
                                    "purchaseDate": "2099-12-31T00:00:00Z"
                                }
                                """)
                        .when()
                        .patch("/api/v1/items/{id}", item.id.toHexString())
                        .then()
                        .statusCode(400);
            }

            @Test
            @DisplayName("PATCH with other fields + purchasePrice → 400")
            void mixedWithImmutableField() {
                Item item = createTestItem(orgId, "Test Item", ItemStatus.AVAILABLE);

                given()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + adminToken)
                        .body("""
                                {
                                    "name": "Updated",
                                    "purchasePrice": 9999.99
                                }
                                """)
                        .when()
                        .patch("/api/v1/items/{id}", item.id.toHexString())
                        .then()
                        .statusCode(400);
            }
        }

        @Nested
        @DisplayName("DELETE /items/:id")
        class Delete {

            @Test
            @DisplayName("AVAILABLE item → 204, hard deleted from DB")
            void availableItem() {
                Item item = createTestItem(orgId, "To Delete", ItemStatus.AVAILABLE);

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .delete("/api/v1/items/{id}", item.id.toHexString())
                        .then()
                        .statusCode(204);

                // Item should be completely gone (hard delete), not just soft-deleted
                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .get("/api/v1/items/{id}", item.id.toHexString())
                        .then()
                        .statusCode(404);

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .get("/api/v1/items")
                        .then()
                        .statusCode(200)
                        .body("size()", equalTo(0));
            }

            @Test
            @DisplayName("SOLD item → 409")
            void soldItem() {
                Item item = createTestItem(orgId, "Sold Item", ItemStatus.SOLD);

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .delete("/api/v1/items/{id}", item.id.toHexString())
                        .then()
                        .statusCode(409);
            }
        }

        @Nested
        @DisplayName("legacy/unknown status values in DB")
        class LegacyStatus {

            /**
             * Items with a removed status value (e.g. "DELETED") exist in the production
             * database. The API must not crash with a 500; it should return them with
             * status UNKNOWN so the user can edit or delete them.
             */
            @Test
            @DisplayName("item with legacy DELETED status in DB → 200 with status UNKNOWN")
            void legacyDeletedStatus_returnsUnknown() {
                insertRawItem(orgId, "Legacy Item", "DELETED");

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .get("/api/v1/items")
                        .then()
                        .statusCode(200)
                        .body("size()", equalTo(1))
                        .body("[0].name", equalTo("Legacy Item"))
                        .body("[0].status", equalTo("UNKNOWN"));
            }

            /**
             * Items with a completely unrecognized status string should also
             * gracefully degrade to UNKNOWN.
             */
            @Test
            @DisplayName("item with arbitrary unknown status in DB → 200 with status UNKNOWN")
            void arbitraryUnknownStatus_returnsUnknown() {
                insertRawItem(orgId, "Mystery Item", "SOME_FUTURE_STATUS");

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .get("/api/v1/items")
                        .then()
                        .statusCode(200)
                        .body("size()", equalTo(1))
                        .body("[0].name", equalTo("Mystery Item"))
                        .body("[0].status", equalTo("UNKNOWN"));
            }

            /**
             * Mixed results: valid items alongside legacy items should all be returned.
             */
            @Test
            @DisplayName("mix of valid and legacy status items → 200 with all items")
            void mixedStatuses_allReturned() {
                createTestItem(orgId, "Normal Item", ItemStatus.AVAILABLE);
                insertRawItem(orgId, "Old Item", "DELETED");

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .get("/api/v1/items")
                        .then()
                        .statusCode(200)
                        .body("size()", equalTo(2))
                        .body("name", hasItems("Normal Item", "Old Item"));
            }

            /**
             * GET /items/:id must also handle legacy status without crashing.
             */
            @Test
            @DisplayName("GET /items/:id with legacy status → 200 with status UNKNOWN")
            void getById_legacyStatus_returnsUnknown() {
                Document doc = insertRawItem(orgId, "Legacy Single", "DELETED");
                String itemId = doc.getObjectId("_id").toHexString();

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .get("/api/v1/items/{id}", itemId)
                        .then()
                        .statusCode(200)
                        .body("name", equalTo("Legacy Single"))
                        .body("status", equalTo("UNKNOWN"));
            }

            /**
             * PATCH must be able to deserialize and update a legacy-status item
             * without crashing.
             */
            @Test
            @DisplayName("PATCH /items/:id with legacy status → 200, can update name")
            void patch_legacyStatus_canUpdate() {
                Document doc = insertRawItem(orgId, "Patchable Legacy", "DELETED");
                String itemId = doc.getObjectId("_id").toHexString();

                given()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + adminToken)
                        .body("""
                                {"name": "Renamed Legacy"}
                                """)
                        .when()
                        .patch("/api/v1/items/{id}", itemId)
                        .then()
                        .statusCode(200)
                        .body("name", equalTo("Renamed Legacy"));
            }

            /**
             * DELETE must be able to deserialize and hard-delete a legacy-status item.
             * UNKNOWN status is not SOLD, so deletion should succeed.
             */
            @Test
            @DisplayName("DELETE /items/:id with legacy status → 204")
            void delete_legacyStatus_succeeds() {
                Document doc = insertRawItem(orgId, "Deletable Legacy", "DELETED");
                String itemId = doc.getObjectId("_id").toHexString();

                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .delete("/api/v1/items/{id}", itemId)
                        .then()
                        .statusCode(204);
            }
        }

        @Nested
        @DisplayName("businessId injection")
        class BusinessIdInjection {

            @Test
            @DisplayName("POST /items with attacker businessId in body → 403 rejected by security filter")
            void createItemIgnoresBodyBusinessId() {
                String attackerOrgId = "aaaaaaaaaaaaaaaaaaaaaaaa";

                given()
                        .contentType(ContentType.JSON)
                        .header("Authorization", "Bearer " + adminToken)
                        .body("""
                                {
                                    "name": "Injected Item",
                                    "condition": "GOOD",
                                    "purchasePrice": 100.00,
                                    "purchaseDate": "2025-01-15T00:00:00Z",
                                    "businessId": "%s"
                                }
                                """.formatted(attackerOrgId))
                        .when()
                        .post("/api/v1/items")
                        .then()
                        .statusCode(403)
                        .body("message", equalTo("Business ID mismatch"));

                // Verify no item was persisted
                given()
                        .header("Authorization", "Bearer " + adminToken)
                        .when()
                        .get("/api/v1/items")
                        .then()
                        .statusCode(200)
                        .body("size()", equalTo(0));
            }
        }

        @Nested
        @DisplayName("no token → 401")
        class Unauthenticated {

            @Test
            @DisplayName("POST /items → 401")
            void postNoToken() {
                given()
                        .contentType(ContentType.JSON)
                        .body("""
                                {"name":"X","condition":"GOOD","purchasePrice":10,"purchaseDate":"2025-01-15T00:00:00Z"}
                                """)
                        .when()
                        .post("/api/v1/items")
                        .then()
                        .statusCode(401);
            }

            @Test
            @DisplayName("GET /items → 401")
            void getListNoToken() {
                given()
                        .when()
                        .get("/api/v1/items")
                        .then()
                        .statusCode(401);
            }

            @Test
            @DisplayName("GET /items/:id → 401")
            void getByIdNoToken() {
                given()
                        .when()
                        .get("/api/v1/items/aaaaaaaaaaaaaaaaaaaaaaaa")
                        .then()
                        .statusCode(401);
            }

            @Test
            @DisplayName("PATCH /items/:id → 401")
            void patchNoToken() {
                given()
                        .contentType(ContentType.JSON)
                        .body("{\"name\":\"X\"}")
                        .when()
                        .patch("/api/v1/items/aaaaaaaaaaaaaaaaaaaaaaaa")
                        .then()
                        .statusCode(401);
            }

            @Test
            @DisplayName("DELETE /items/:id → 401")
            void deleteNoToken() {
                given()
                        .when()
                        .delete("/api/v1/items/aaaaaaaaaaaaaaaaaaaaaaaa")
                        .then()
                        .statusCode(401);
            }
        }
    }

    /**
     * Inserts a raw BSON document into the items collection, bypassing Java enum
     * validation. Used to simulate legacy or corrupted documents with status values
     * that no longer exist in the ItemStatus enum.
     */
    private Document insertRawItem(String businessId, String name, String rawStatus) {
        Document doc = new Document()
                .append("businessId", businessId)
                .append("name", name)
                .append("brand", "Gucci")
                .append("category", "Handbags")
                .append("condition", "EXCELLENT")
                .append("purchasePrice", new Decimal128(new BigDecimal("250.00")))
                .append("purchaseDate", Date.from(Instant.parse("2025-01-15T00:00:00Z")))
                .append("status", rawStatus)
                .append("createdAt", Date.from(Instant.now()))
                .append("updatedAt", Date.from(Instant.now()));
        mongoClient.getDatabase(databaseName)
                .getCollection("items")
                .insertOne(doc);
        return doc;
    }

    /**
     * Creates and persists a test item with the given businessId, name, and status
     * using the standard Java model layer.
     */
    private Item createTestItem(String businessId, String name, ItemStatus status) {
        Item item = new Item();
        item.businessId = businessId;
        item.name = name;
        item.brand = "Gucci";
        item.category = "Handbags";
        item.condition = ItemCondition.EXCELLENT;
        item.purchasePrice = new Decimal128(new BigDecimal("250.00"));
        item.purchaseDate = Instant.parse("2025-01-15T00:00:00Z");
        item.status = status;
        item.createdAt = Instant.now();
        item.updatedAt = Instant.now();
        itemRepository.persist(item);
        return item;
    }
}

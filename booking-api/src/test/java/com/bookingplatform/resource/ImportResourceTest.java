package com.bookingplatform.resource;

import com.bookingplatform.model.Item;
import com.bookingplatform.model.Sale;
import com.bookingplatform.model.User;
import com.bookingplatform.repository.ItemRepository;
import com.bookingplatform.repository.OrganizationRepository;
import com.bookingplatform.repository.SaleRepository;
import com.bookingplatform.repository.UserRepository;
import com.bookingplatform.security.SecurityEnabledProfile;
import com.bookingplatform.service.AuthService;
import io.quarkus.test.common.QuarkusTestResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.quarkus.test.mongodb.MongoTestResource;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import org.bson.types.Decimal128;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for the Import API (preview + confirm endpoints).
 * Uses Pattern D from CONTEXT.md: register org, extract admin JWT, call endpoints.
 */
@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
@TestProfile(SecurityEnabledProfile.class)
@DisplayName("Import API")
class ImportResourceTest {

    @Inject ItemRepository itemRepository;
    @Inject SaleRepository saleRepository;
    @Inject OrganizationRepository organizationRepository;
    @Inject UserRepository userRepository;
    @Inject AuthService authService;

    private String adminToken;
    private String orgId;

    /**
     * Registers a fresh org and admin user, clears all collections before each test.
     */
    @BeforeEach
    void setUp() {
        saleRepository.deleteAll();
        itemRepository.deleteAll();
        userRepository.deleteAll();
        organizationRepository.deleteAll();

        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                    "orgName": "Import Test Org",
                    "orgSlug": "import-test",
                    "adminEmail": "admin@import-test.com",
                    "adminDisplayName": "Admin"
                }
                """)
        .when()
            .post("/api/v1/auth/register")
        .then()
            .statusCode(201);

        User admin = userRepository.findByEmail("admin@import-test.com").orElseThrow();
        adminToken = authService.generateUserJwt(admin);
        orgId = admin.orgId.toHexString();
    }

    /**
     * Creates a user with the given role and returns a JWT for that user.
     *
     * @param email the user's email
     * @param role  the role to assign (ADMIN, BUYER, SELLER, ACCOUNTANT)
     * @return JWT token string
     */
    private String createUserAndGetToken(String email, String role) {
        given()
            .contentType(ContentType.JSON)
            .header("Authorization", "Bearer " + adminToken)
            .body("""
                {
                    "email": "%s",
                    "displayName": "%s User",
                    "role": "%s"
                }
                """.formatted(email, role, role))
        .when()
            .post("/api/v1/users")
        .then()
            .statusCode(201);

        User user = userRepository.findByEmail(email).orElseThrow();
        return authService.generateUserJwt(user);
    }

    @Nested @DisplayName("POST /imports/preview")
    class Preview {

        @Test @DisplayName("valid eBay CSV → 200 with counts and rows")
        void test_preview_validEbayCsv_returns200WithCounts() {
            given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .body("validRows", greaterThanOrEqualTo(1))
                .body("totalRows", greaterThanOrEqualTo(1))
                .body("rows.size()", greaterThanOrEqualTo(1))
                .body("rowLimit", equalTo(2000));
        }

        @Test @DisplayName("oversized file (>5 MB) → 400")
        void test_preview_oversizedFile_returns400() {
            byte[] oversized = new byte[5 * 1024 * 1024 + 1];

            given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "big.csv", oversized, "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(400);
        }

        @Test @DisplayName("non-CSV content type → 400")
        void test_preview_nonCsvContentType_returns400() {
            given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "data.txt", "some text".getBytes(), "text/plain")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(400);
        }

        @Test @DisplayName("non-admin role → 403")
        void test_preview_nonAdminRole_returns403() {
            String sellerToken = createUserAndGetToken("seller@import-test.com", "SELLER");

            given()
                .header("Authorization", "Bearer " + sellerToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("detects duplicates and marks isDuplicate on matching rows")
        void test_preview_detectsDuplicates_marksRowIsDuplicate() {
            // Seed a sale with externalOrderId matching the first row in ebay_valid.csv
            Sale existing = new Sale();
            existing.businessId = orgId;
            existing.platform = "EBAY";
            existing.externalOrderId = "28-12345-67890";
            existing.itemId = "aaaaaaaaaaaaaaaaaaaaaaaa";
            existing.salePrice = new Decimal128(new BigDecimal("75.00"));
            existing.platformFees = new Decimal128(new BigDecimal("9.75"));
            existing.netProceeds = new Decimal128(new BigDecimal("65.25"));
            existing.profit = new Decimal128(new BigDecimal("65.25"));
            existing.soldAt = Instant.now();
            existing.createdAt = Instant.now();
            saleRepository.persist(existing);

            given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .body("duplicateRows", equalTo(1))
                .body("rows.find { it.externalOrderId == '28-12345-67890' }.isDuplicate", equalTo(true));
        }

        @Test @DisplayName("rate limit exceeded → 429")
        void test_preview_rateLimitExceeded_returns429() {
            String minimalCsv = "Order number,Item title,Sale date,Unit price,Final value fee - fixed,Final value fee - variable\n"
                + "99-00000-00001,Test,2024-01-01,10.00,0.30,1.00\n";

            int lastStatus = 200;
            for (int i = 0; i < 21; i++) {
                lastStatus = given()
                    .header("Authorization", "Bearer " + adminToken)
                    .multiPart("file", "small.csv", minimalCsv.getBytes(), "text/csv")
                    .formParam("platform", "EBAY")
                .when()
                    .post("/api/v1/imports/preview")
                .then()
                    .extract().statusCode();
                if (lastStatus == 429) break;
            }
            assertEquals(429, lastStatus, "Expected 429 after exceeding rate limit");
        }
    }

    @Nested @DisplayName("POST /imports/confirm")
    class Confirm {

        @Test @DisplayName("valid rows → imports items and sales with defaults")
        void test_confirm_validRows_importsItemsAndSalesWithDefaults() {
            // First preview to get parsed rows
            var previewResponse = given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .extract().body().asString();

            // Confirm the rows
            given()
                .header("Authorization", "Bearer " + adminToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(extractRowsJson(previewResponse)))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(200)
                .body("imported", equalTo(3));

            // Verify Items in MongoDB
            List<Item> items = itemRepository.list("businessId", orgId);
            assertEquals(3, items.size(), "Expected 3 items created");
            for (Item item : items) {
                assertTrue(item.costEntryPending, "costEntryPending should be true");
                assertEquals(new Decimal128(BigDecimal.ZERO), item.purchasePrice,
                    "purchasePrice should default to 0.00");
                assertNotNull(item.purchaseDate,
                    "purchaseDate should default to the day before saleDate");
            }

            // Verify Sales in MongoDB
            List<Sale> sales = saleRepository.list("businessId", orgId);
            assertEquals(3, sales.size(), "Expected 3 sales created");
            for (Sale sale : sales) {
                assertNotNull(sale.externalOrderId, "externalOrderId should be set");
                assertNotNull(sale.profit, "profit should not be null");
                // Each sale.itemId should resolve to an existing Item
                Item linked = itemRepository.findById(new org.bson.types.ObjectId(sale.itemId));
                assertNotNull(linked, "Sale.itemId should resolve to an existing Item");
            }
        }

        @Test @DisplayName("purchaseDate defaults to one day before saleDate")
        void test_confirm_purchaseDateDefaultsToDayBeforeSaleDate() {
            var previewResponse = given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .extract().body().asString();

            given()
                .header("Authorization", "Bearer " + adminToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(extractRowsJson(previewResponse)))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(200);

            // ebay_valid.csv first row: saleDate=2024-11-15 → purchaseDate=2024-11-14
            List<Item> items = itemRepository.list("businessId", orgId);
            Item nikeItem = items.stream()
                .filter(i -> i.name.contains("Nike Air Max"))
                .findFirst().orElseThrow();
            assertEquals(Instant.parse("2024-11-14T00:00:00Z"), nikeItem.purchaseDate,
                "purchaseDate should be one day before saleDate (2024-11-15 → 2024-11-14)");
        }

        @Test @DisplayName("profit equals netProceeds when purchasePrice is zero")
        void test_confirm_profitEqualsNetProceedsWhenPurchasePriceIsZero() {
            var previewResponse = given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .extract().body().asString();

            given()
                .header("Authorization", "Bearer " + adminToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(extractRowsJson(previewResponse)))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(200);

            Sale sale = saleRepository.list("businessId", orgId).getFirst();
            assertEquals(sale.netProceeds.bigDecimalValue().compareTo(sale.profit.bigDecimalValue()), 0,
                "profit should equal netProceeds when purchasePrice is zero");
        }

        @Test @DisplayName("skips duplicates on second import")
        void test_confirm_skipsDuplicates_onSecondImport() {
            var previewResponse = given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .extract().body().asString();

            String rowsJson = extractRowsJson(previewResponse);

            // First confirm
            given()
                .header("Authorization", "Bearer " + adminToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(rowsJson))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(200)
                .body("imported", equalTo(3));

            // Second confirm with same rows
            given()
                .header("Authorization", "Bearer " + adminToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(rowsJson))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(200)
                .body("imported", equalTo(0))
                .body("skippedDuplicates", equalTo(3));
        }

        @Test @DisplayName("tampered salePrice rejected by server re-validation")
        void test_confirm_tamperedSalePrice_rejectedServerSide() {
            var previewResponse = given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .extract().body().asString();

            // Tamper: set first row's salePrice to 0.00 (fails salePrice > 0 check)
            String tamperedRows = extractRowsJson(previewResponse)
                .replaceFirst("\"salePrice\":\\s*\\d+\\.?\\d*", "\"salePrice\":0.00");

            given()
                .header("Authorization", "Bearer " + adminToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(tamperedRows))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(200)
                .body("imported", lessThan(3))
                .body("batchErrors", greaterThanOrEqualTo(1));
        }

        @Test @DisplayName("non-admin role → 403")
        void test_confirm_nonAdminRole_returns403() {
            String sellerToken = createUserAndGetToken("seller2@import-test.com", "SELLER");

            given()
                .header("Authorization", "Bearer " + sellerToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": []
                    }
                    """)
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(403);
        }

        @Test @DisplayName("exceeds 2000 rows → 400")
        void test_confirm_exceeds2000Rows_returns400() {
            // Build a JSON array with 2001 minimal row objects
            StringBuilder sb = new StringBuilder("[");
            for (int i = 0; i < 2001; i++) {
                if (i > 0) sb.append(",");
                sb.append("""
                    {"rowNumber":%d,"externalOrderId":"order-%d","title":"Item %d",
                     "saleDate":"2024-01-01","salePrice":10.00,"platformFees":1.00,
                     "netProceeds":9.00,"isDuplicate":false}
                    """.formatted(i, i, i));
            }
            sb.append("]");

            given()
                .header("Authorization", "Bearer " + adminToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(sb.toString()))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(400);
        }

        @Test @DisplayName("cross-org isolation: each org gets its own items")
        void test_confirm_crossOrgIsolation() {
            // Register org B
            given()
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "orgName": "Org B",
                        "orgSlug": "org-b",
                        "adminEmail": "admin@org-b.com",
                        "adminDisplayName": "Admin B"
                    }
                    """)
            .when()
                .post("/api/v1/auth/register")
            .then()
                .statusCode(201);

            User adminB = userRepository.findByEmail("admin@org-b.com").orElseThrow();
            String tokenB = authService.generateUserJwt(adminB);
            String orgIdB = adminB.orgId.toHexString();

            // Preview as org A
            var previewA = given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .extract().body().asString();

            // Confirm as org A
            given()
                .header("Authorization", "Bearer " + adminToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(extractRowsJson(previewA)))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(200)
                .body("imported", equalTo(3));

            // Preview as org B (same CSV, should not be duplicates for B)
            var previewB = given()
                .header("Authorization", "Bearer " + tokenB)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .body("duplicateRows", equalTo(0))
                .extract().body().asString();

            // Confirm as org B
            given()
                .header("Authorization", "Bearer " + tokenB)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(extractRowsJson(previewB)))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(200)
                .body("imported", equalTo(3));

            // Verify isolation
            assertEquals(3, itemRepository.list("businessId", orgId).size(),
                "Org A should have 3 items");
            assertEquals(3, itemRepository.list("businessId", orgIdB).size(),
                "Org B should have 3 items");
        }

        @Test @DisplayName("batch errors with partial success → 200")
        void test_confirm_batchErrors_partialSuccessReturns200() {
            // Seed a sale to cause a duplicate-key collision on one row
            Sale existing = new Sale();
            existing.businessId = orgId;
            existing.platform = "EBAY";
            existing.externalOrderId = "28-12345-67890";
            existing.itemId = "aaaaaaaaaaaaaaaaaaaaaaaa";
            existing.salePrice = new Decimal128(new BigDecimal("75.00"));
            existing.platformFees = new Decimal128(new BigDecimal("9.75"));
            existing.netProceeds = new Decimal128(new BigDecimal("65.25"));
            existing.profit = new Decimal128(new BigDecimal("65.25"));
            existing.soldAt = Instant.now();
            existing.createdAt = Instant.now();
            saleRepository.persist(existing);

            var previewResponse = given()
                .header("Authorization", "Bearer " + adminToken)
                .multiPart("file", "ebay_valid.csv",
                    getClass().getClassLoader().getResourceAsStream("fixtures/ebay_valid.csv"),
                    "text/csv")
                .formParam("platform", "EBAY")
            .when()
                .post("/api/v1/imports/preview")
            .then()
                .statusCode(200)
                .extract().body().asString();

            // Confirm all rows — the duplicate one should be skipped
            given()
                .header("Authorization", "Bearer " + adminToken)
                .contentType(ContentType.JSON)
                .body("""
                    {
                        "platform": "EBAY",
                        "rows": %s
                    }
                    """.formatted(extractRowsJson(previewResponse)))
            .when()
                .post("/api/v1/imports/confirm")
            .then()
                .statusCode(200)
                .body("skippedDuplicates", greaterThanOrEqualTo(1))
                .body("imported", lessThan(3));
        }
    }

    // --- helpers ---

    /**
     * Extracts the "rows" JSON array from a preview response string.
     *
     * @param previewJson the full preview response JSON
     * @return the rows array as a JSON string
     */
    private String extractRowsJson(String previewJson) {
        // Find the "rows" array in the JSON response
        int start = previewJson.indexOf("\"rows\":");
        if (start == -1) throw new IllegalArgumentException("No 'rows' key in response");
        start = previewJson.indexOf("[", start);
        int depth = 0;
        int end = start;
        for (int i = start; i < previewJson.length(); i++) {
            if (previewJson.charAt(i) == '[') depth++;
            if (previewJson.charAt(i) == ']') depth--;
            if (depth == 0) { end = i + 1; break; }
        }
        return previewJson.substring(start, end);
    }
}

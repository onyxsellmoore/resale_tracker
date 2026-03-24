package com.bookingplatform.resource;

import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.nullValue;

/**
 * CORS preflight smoke tests — run against the live Cloud Run service.
 * Skips automatically when CLOUD_RUN_URL is not set (local CI).
 */
@DisplayName("CORS Preflight")
class CorsPreflightTest {

    private static final String BASE_URL = System.getenv("CLOUD_RUN_URL");
    private static final boolean SKIP = BASE_URL == null || BASE_URL.isBlank();

    @BeforeAll
    static void setUp() {
        if (!SKIP) {
            RestAssured.baseURI = BASE_URL;
        }
    }

    @Test @DisplayName("preflight with allowed Firebase origin echoes it back")
    void preflight_allowedFirebaseOrigin_returnsAllowOrigin() {
        if (SKIP) return;
        given()
            .header("Origin", "https://resale-tracker-pr.web.app")
            .header("Access-Control-Request-Method", "GET")
        .when()
            .options("/api/v1/items")
        .then()
            .statusCode(200)
            .header("Access-Control-Allow-Origin", equalTo("https://resale-tracker-pr.web.app"));
    }

    @Test @DisplayName("preflight with allowed localhost origin echoes it back")
    void preflight_allowedLocalhostOrigin_returnsAllowOrigin() {
        if (SKIP) return;
        given()
            .header("Origin", "http://localhost:5173")
            .header("Access-Control-Request-Method", "GET")
        .when()
            .options("/api/v1/items")
        .then()
            .statusCode(200)
            .header("Access-Control-Allow-Origin", equalTo("http://localhost:5173"));
    }

    @Test @DisplayName("preflight with disallowed origin has no Allow-Origin")
    void preflight_disallowedOrigin_noAllowOriginHeader() {
        if (SKIP) return;
        given()
            .header("Origin", "https://evil.example.com")
            .header("Access-Control-Request-Method", "GET")
        .when()
            .options("/api/v1/items")
        .then()
            .header("Access-Control-Allow-Origin", nullValue());
    }
}

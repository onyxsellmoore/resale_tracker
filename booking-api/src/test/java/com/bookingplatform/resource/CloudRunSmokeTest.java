package com.bookingplatform.resource;

import io.restassured.RestAssured;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static io.restassured.http.ContentType.JSON;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.notNullValue;

@DisplayName("Cloud Run Smoke Tests")
class CloudRunSmokeTest {

    private static final String BASE_URL = System.getenv("CLOUD_RUN_URL");
    private static final boolean SKIP = BASE_URL == null || BASE_URL.isBlank();

    @BeforeAll
    static void setUp() {
        if (!SKIP) {
            assert BASE_URL.startsWith("https://") : "CLOUD_RUN_URL must start with https://";
            RestAssured.baseURI = BASE_URL;
        }
    }

    @Test void unauthenticated_items_returns401() {
        if (SKIP) return;
        given().accept(JSON).get("/api/v1/items").then().statusCode(401);
    }

    @Test void health_check_returns_UP() {
        if (SKIP) return;
        given().get("/q/health").then().statusCode(200).body("status", equalTo("UP"));
    }

    @Test void register_org_returns201() {
        if (SKIP) return;
        long ts = System.currentTimeMillis();
        given().contentType(JSON)
            .body("""
                {"orgName":"Smoke Org","orgSlug":"smoke-%d",
                 "adminEmail":"smoke-%d@example.com","adminDisplayName":"Admin"}
                """.formatted(ts, ts))
            .post("/api/v1/auth/register")
            .then().statusCode(201)
            .body("orgId", notNullValue())
            .body("userId", notNullValue())
            .body("role", equalTo("ADMIN"));
    }

    @Test void duplicate_slug_returns409() {
        if (SKIP) return;
        long ts = System.currentTimeMillis();
        String body = """
            {"orgName":"Dup Org","orgSlug":"dup-%d",
             "adminEmail":"dup-%d@example.com","adminDisplayName":"Admin"}
            """.formatted(ts, ts);

        given().contentType(JSON).body(body)
            .post("/api/v1/auth/register").then().statusCode(201);

        given().contentType(JSON).body(body)
            .post("/api/v1/auth/register").then().statusCode(409);
    }
}

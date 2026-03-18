# Booking Platform — Black-Box Regression Suite

Karate-based integration tests that exercise the booking-api through its HTTP interface.
No source code or classpath dependency on the API — just HTTP calls against a running instance.

## Prerequisites

| Dependency | Version |
|------------|---------|
| Java       | 21+     |
| Maven      | 3.9+    |
| MongoDB    | 7+      |
| booking-api | running on `localhost:8080` with `booking.dev-token.enabled=true` |

Start the API in dev mode before running the suite:

```bash
cd ../booking-api
./mvnw quarkus:dev
```

## Run

```bash
cd booking-regression
mvn test
```

Override the base URL:

```bash
mvn test -DBOOKING_API_URL=http://localhost:9090
```

Or via environment variable:

```bash
export BOOKING_API_URL=http://staging.example.com
mvn test
```

## Feature Files

| Directory | Coverage |
|-----------|----------|
| `features/auth/` | Registration, passkey login/register flows, token lifecycle |
| `features/items/` | CRUD, immutable fields, status filtering |
| `features/sales/` | Create, read, fee validation, computed fields |
| `features/analytics/` | Access control and summary data |
| `features/users/` | Create and list team members |
| `features/security/` | Full role matrix, cross-org isolation, unauthenticated access |

## Reports

After a run, Karate HTML reports are generated at:

```
target/karate-reports/karate-summary.html
```

Open in a browser to see per-feature pass/fail with request/response detail.

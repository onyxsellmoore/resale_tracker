# Inventory & Sales Ledger — Backend API

Quarkus 3 + MongoDB backend for tracking inventory purchases and sales.

## Prerequisites

- Java 21 (via SDKMAN: `sdk use java 21.0.9-jbr`)
- Docker (for MongoDB)

## Quick Start

```bash
# 1. Start MongoDB (make sure Docker Desktop is running)
docker run -d --name booking-mongo -p 27017:27017 mongo:7

# 2. Run the backend in dev mode
./mvnw quarkus:dev
```

Backend runs at http://localhost:8080. Dev UI at http://localhost:8080/q/dev/.

## Run Tests

```bash
./mvnw test
```

Tests use an embedded test MongoDB — no Docker needed. Stop any local MongoDB first (`docker stop booking-mongo`) to free port 27017.

## Run Frontend

```bash
cd ../booking-ui
npm install
npm run dev
```

Frontend runs at http://localhost:5173.

## Full Stack via Docker Compose

```bash
docker compose up
```

This starts MongoDB, the backend, the frontend, and Mongo Express (http://localhost:8081).

## API Endpoints

### Items
- `POST /api/v1/items` — Add inventory item
- `GET /api/v1/items?businessId=X&status=AVAILABLE` — List items
- `GET /api/v1/items/{id}?businessId=X` — Get item
- `PATCH /api/v1/items/{id}` — Update item
- `DELETE /api/v1/items/{id}?businessId=X` — Soft-delete item

### Sales
- `POST /api/v1/sales` — Record a sale
- `GET /api/v1/sales?businessId=X` — List sales
- `GET /api/v1/sales/{id}?businessId=X` — Get sale

### Analytics
- `GET /api/v1/analytics?businessId=X&from=YYYY-MM-DD&to=YYYY-MM-DD` — Summary, by-platform, by-category, by-month breakdowns

## Security Model

- **Authentication**: Custom JWT (HS256) with 15-minute expiry. JWT secret must be >= 256 bits (32 bytes); enforced at token generation time.
- **Token rotation**: Refresh tokens are single-use. On each `/auth/refresh` call, the old token is revoked and a new access token is issued. Refresh tokens expire after 7 days.
- **IDOR protection**: Every single-resource endpoint (GET/PATCH/DELETE by ID) filters by both the resource `id` AND `businessId` from the JWT. Cross-org access returns 404.
- **WebAuthn sign-count enforcement**: On login, the authenticator's `signCount` must exceed the stored value (unless zero). A stale or replayed sign count is rejected, detecting authenticator cloning.
- **Rate limiting**: Auth endpoints (`/register`, `/login/begin`, `/login/password`) are guarded by `AuthRateLimiter` — a sliding-window guard allowing max 10 requests per IP per minute.
- **Role-based access**: All mutating endpoints check caller role via `RoleChecker.can(role, operation)`. See `RoleChecker.java` for the operation→role mapping.
- **Immutable fields**: `purchasePrice` and `purchaseDate` cannot be changed after item creation (PATCH returns 400).
- **businessId source**: Always extracted from the JWT (`orgId` claim). Client-supplied `businessId` in request bodies is ignored when JWT is present.

## Test Coverage

### Security test classes
- `CrossOrgIsolationTest` — Verifies org A cannot read/update/delete org B's items or sales (IDOR protection)
- `RoleAccessTest` — Verifies role-based access for all endpoints (ADMIN, BUYER, SELLER, ACCOUNTANT)
- `AuthResourceTest` — Passkey registration/login flows, password login, refresh token rotation (single-use), revoked/expired/malformed token rejection, duplicate registration
- `SecurityFilterTest` — JWT validation, public endpoint bypass, businessId mismatch detection

### Resource test classes
- `ItemResourceTest` — CRUD, validation, immutability enforcement (purchasePrice/purchaseDate), businessId injection prevention
- `SaleResourceTest` — CRUD, computed fields, date validation, duplicate detection, businessId injection prevention
- `AnalyticsResourceTest` — Role restrictions, date range queries
- `CorsPreflightTest` — CORS preflight handling

## CI/CD

Backend tests run automatically on every PR and push to `main` via GitHub Actions (`.github/workflows/ci.yml` and `deploy.yml`). On push to `main`, the deploy workflow builds a Docker image, pushes to Artifact Registry, and deploys to Cloud Run. Security scanning uses OWASP Dependency Check (CVSSv3 ≥ 7 fails the build). See `scripts/gcp-setup.sh` to bootstrap the GCP project.

# CONTEXT.md — Take A Vintage (TAV) Booking Platform
<!-- Re-generate by running the generate-context prompt against Claude Code -->

## 1. Project Purpose

Inventory and sales ledger for vintage/luxury resellers trading on multiple platforms (eBay, Poshmark, etc.).
"Booking" means bookkeeping — tracking cost-of-goods, sale prices, platform fees, and profit — not appointment scheduling.
Local dev via Docker Compose; production on GCP (Cloud Run + Firebase Hosting + Atlas).

## 2. Tech Stack

| Layer         | Value                                              |
|---------------|----------------------------------------------------|
| Backend       | Quarkus 3.32, Java 25, JAX-RS, Panache MongoDB     |
| Database      | MongoDB 7 (via docker-compose)                      |
| Database (prod) | MongoDB Atlas M0 (GCP us-central1, permanent free tier) |
| Backend (prod)  | Google Cloud Run (us-central1, 2M req/month free)     |
| Frontend (prod) | Firebase Hosting (Spark free tier, global CDN)        |
| Secrets         | Google Secret Manager (6 active versions free)        |
| Container registry | GCP Artifact Registry (0.5 GB free)                |
| Money type    | `Decimal128` (storage) / `BigDecimal` (compute)     |
| Frontend      | React 19, TypeScript 5.9, Vite 8, React Router 7   |
| State/Fetch   | TanStack React Query 5, Axios                       |
| Charts        | Recharts 3                                          |
| Auth          | Custom JWT (HS256) + WebAuthn passkeys (no passwords) |
| Build (BE)    | Maven (quarkus-maven-plugin)                        |
| Build (FE)    | Vite + tsc                                          |
| Unit tests    | JUnit 5 + REST-assured (BE), Vitest + Testing Lib (FE) |
| E2E tests     | Playwright                                          |
| Local dev     | docker-compose (mongo, mongo-express)                |

## 3. Domain Model

```
Organization  (collection: "organizations")
  name         String     — display name
  slug         String     — unique URL-safe identifier
  createdAt    Instant

User  (collection: "users")
  orgId        ObjectId   — FK → Organization
  email        String     — unique login identifier
  displayName  String
  role         Role       — ADMIN | BUYER | SELLER | ACCOUNTANT
  createdAt    Instant

Item  (collection: "items")
  businessId   String     — org/business scope key
  name         String     — item display name
  brand        String
  category     String
  condition    ItemCondition — EXCELLENT | GOOD | FAIR | POOR
  purchasePrice Decimal128 — cost-of-goods (immutable after create)
  purchaseDate Instant     — (immutable after create)
  description  String
  notes        String
  status       ItemStatus  — AVAILABLE | SOLD | DELETED

Sale  (collection: "sales")
  businessId   String     — org/business scope key
  itemId       String     — FK → Item
  platform     String     — selling platform name
  salePrice    Decimal128
  platformFees Decimal128
  netProceeds  Decimal128 — (computed) salePrice - platformFees
  profit       Decimal128 — (computed) netProceeds - purchasePrice

Business  (collection: "businesses")
  name         String
  timezone     String
  plan         String
  active       boolean

RefreshToken  (collection: "refresh_tokens")
  tokenHash    String     — SHA-256 of opaque token
  ownerId      String
  businessId   String
  expiresAt    Instant    — TTL index, 7-day expiry
  revoked      boolean

WebAuthnCredential  (collection: "webauthn_credentials")
  ownerId      String
  credentialId String     — base64url-encoded
  publicKey    String     — base64url-encoded COSE key
  signCount    long
```

## 4. Role Permission Matrix

```
Endpoint                    ADMIN  BUYER  SELLER  ACCOUNTANT
─────────────────────────── ─────  ─────  ──────  ──────────
POST   /api/v1/items          ✓      ✓      –       –
GET    /api/v1/items          ✓      ✓      ✓       ✓
GET    /api/v1/items/:id      ✓      ✓      ✓       ✓
PATCH  /api/v1/items/:id      ✓      ✓      ✓       ✓
DELETE /api/v1/items/:id      ✓      –      –       –
POST   /api/v1/sales          ✓      –      ✓       –
GET    /api/v1/sales          ✓      ✓      ✓       ✓
GET    /api/v1/sales/:id      ✓      ✓      ✓       ✓
GET    /api/v1/analytics      ✓      –      –       ✓
POST   /api/v1/users          ✓      –      –       –
GET    /api/v1/users          ✓      –      –       –
POST   /api/v1/auth/*         [PUBLIC — no JWT required]
```

## 5. API Endpoints

```
BACKEND: /api/v1/auth
  POST /register             — create org + admin user (no password) [PUBLIC]
  POST /register/begin       — start passkey registration challenge  [PUBLIC]
  POST /register/complete    — verify attestation, store credential  [PUBLIC]
  POST /login/begin          — start passkey login challenge         [PUBLIC]
  POST /login/complete       — verify passkey assertion              [PUBLIC]
  POST /refresh              — refresh access token                  [PUBLIC]
  POST /logout               — revoke refresh token                  [PUBLIC]

BACKEND: /api/v1/items
  POST /                     — create inventory item              [ADMIN,BUYER]
  GET  /                     — list items (?status=AVAILABLE)     [ALL ROLES]
  GET  /:id                  — get single item                    [ALL ROLES]
  PATCH /:id                 — update mutable fields              [ALL ROLES]
  DELETE /:id                — soft-delete (→ DELETED status)     [ADMIN]

BACKEND: /api/v1/sales
  POST /                     — record sale, mark item SOLD        [ADMIN,SELLER]
  GET  /                     — list sales (?platform&from&to)     [ALL ROLES]
  GET  /:id                  — get single sale                    [ALL ROLES]

BACKEND: /api/v1/analytics
  GET  /                     — summary + breakdowns (?from&to)    [ADMIN,ACCOUNTANT]

BACKEND: /api/v1/users
  POST /                     — create team member                 [ADMIN]
  GET  /                     — list org members                   [ADMIN]
```

## 6. Frontend Routes

```
Path            Component             Access
──────────────  ────────────────────  ─────────────────────────────
/login          LoginPage.tsx         [PUBLIC] ← default redirect
/setup          OrgSetupPage.tsx      [PUBLIC]
/inventory      InventoryPage.tsx     [ADMIN,BUYER,SELLER,ACCOUNTANT]
/sales/*        SalesPage.tsx         [ADMIN,SELLER,ACCOUNTANT]
/analytics      AnalyticsPage.tsx     [ADMIN,ACCOUNTANT] ← post-login landing
/users          UsersPage.tsx         [ADMIN]
/               → redirect /login
```

## 7. Key File Map

```
BACKEND DOMAIN:
  booking-api/src/main/java/.../model/Item.java              — inventory entity, Decimal128 prices
  booking-api/src/main/java/.../model/Sale.java              — sale record with computed profit
  booking-api/src/main/java/.../model/User.java              — user with orgId + role
  booking-api/src/main/java/.../model/Organization.java      — multi-tenant org
  booking-api/src/main/java/.../model/Role.java              — ADMIN|BUYER|SELLER|ACCOUNTANT enum

BACKEND API:
  booking-api/src/main/java/.../resource/ItemResource.java   — CRUD items, role checks, orgId from JWT
  booking-api/src/main/java/.../resource/SaleResource.java   — record sales, validates fees <= price
  booking-api/src/main/java/.../resource/AuthResource.java   — register/login/refresh/logout
  booking-api/src/main/java/.../resource/UserResource.java   — create/list users (ADMIN only)
  booking-api/src/main/java/.../resource/AnalyticsResource.java — aggregated analytics
  booking-api/src/main/java/.../security/SecurityFilter.java — JWT validation, orgId/role extraction
  booking-api/src/main/java/.../security/CorsFilter.java     — Custom CORS filter (PreMatching JAX-RS)
  booking-api/src/main/java/.../security/AuthRateLimiter.java — In-memory sliding-window rate limiter (10 req/IP/min)
  booking-api/src/main/java/.../security/RoleChecker.java    — Centralized role→operation permission map (Set-based O(1) lookup)
  booking-api/src/main/java/.../service/AuthService.java     — JWT sign/verify, WebAuthn passkey registration + login
  booking-api/src/main/java/.../service/AnalyticsService.java — BigDecimal aggregation logic
  booking-api/src/main/java/.../util/MoneyUtils.java         — Decimal128 ↔ BigDecimal conversion

FRONTEND PAGES:
  booking-ui/src/pages/InventoryPage.tsx   — item list + add form
  booking-ui/src/pages/SalesPage.tsx       — sales list + record sale form
  booking-ui/src/pages/AnalyticsPage.tsx   — charts + summary cards
  booking-ui/src/pages/LoginPage.tsx       — email + passkey login
  booking-ui/src/pages/UsersPage.tsx       — team management (ADMIN)
  booking-ui/src/pages/OrgSetupPage.tsx    — org registration

FRONTEND STATE:
  booking-ui/src/auth/AuthContext.tsx       — JWT storage, role, orgId
  booking-ui/src/api/inventoryApi.ts        — item CRUD calls
  booking-ui/src/api/salesApi.ts            — sale API calls
  booking-ui/src/api/analyticsApi.ts        — analytics fetch
  booking-ui/src/AppRoutes.tsx              — route → component → role mapping
  booking-ui/src/utils/rolePermissions.ts  — Role→Set<action> permission map for frontend UI visibility

INFRA:
  docker-compose.yml                        — mongo + mongo-express + backend + frontend
  booking-api/src/main/resources/application.properties — DB, JWT, CORS, WebAuthn config
  booking-ui/src/theme.css                  — CSS custom properties (design tokens)
  firebase.json                             — Firebase Hosting config (SPA rewrite rule, immutable asset cache headers)
  .firebaserc                               — Firebase project alias binding (links this repo to the GCP/Firebase project)
  booking-ui/.env.production                — VITE_API_URL for production build (gitignored; see .env.production.example)
  booking-ui/.env.development               — VITE_API_URL for local dev (gitignored)
```

## 8. Engineering Rules

- **TDD**: Write tests first, then implementation. Always. (CLAUDE.md)
- **Money**: Use `Decimal128` for MongoDB storage, `BigDecimal` for computation. Never `float`/`double` for money.
- **Security — orgId source**: Always extract `orgId`/`businessId` from the JWT (via `requestContext.getProperty("orgId")`). Never trust client-supplied businessId when JWT is present.
- **Security — role checks**: Every mutating endpoint must check caller role via `hasRole()` or explicit `requestContext.getProperty("role")` comparison. Return 403 for unauthorized roles.
- **Security — cross-org isolation**: Items and sales are scoped by `businessId`. Every query filters by `businessId` from JWT. `CrossOrgIsolationTest` verifies this.
- **Security — IDOR**: Single-resource endpoints (GET/PATCH/DELETE by ID) filter by both `id` AND `businessId` from JWT.
- **Security — token rotation**: Refresh tokens are single-use; the token is revoked immediately on use and a new access token is issued.
- **Security — rate limiting**: Auth endpoints (`/register`, `/login/begin`, `/login/password`) are guarded by `AuthRateLimiter` (10 req/IP/min sliding window).
- **Security — immutable fields**: `purchasePrice` and `purchaseDate` are rejected with 400 on PATCH (enforced in `ItemResource.updateItem`).
- **Security — JWT storage**: Frontend stores access tokens in-memory (module-level variable), not localStorage, to mitigate XSS token theft.
- **CSS**: Use CSS custom properties from `theme.css` (`--color-*`, `--font-*`, `--radius-*`). No hardcoded hex values in component CSS.
- **Frontend colors for charts**: Import from `booking-ui/src/utils/chartColors.ts`, which mirrors theme.css tokens.
- **Test hygiene**: `@BeforeEach` deletes all documents. Tests with security enabled use `@TestProfile(SecurityEnabledProfile.class)`.
- **Immutable fields**: `purchasePrice` and `purchaseDate` on Item cannot be changed after creation.
- **Soft delete**: Items are soft-deleted (status → DELETED), never hard-deleted. Sold items cannot be deleted.
- **Simplicity**: Simplicity over everything. No over-engineering. (CLAUDE.md)

## 9. Common Patterns

### PATTERN A — New REST endpoint (Quarkus)
```java
@Path("/api/v1/things")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ThingResource {
    @Inject ThingRepository thingRepository;
    @Context ContainerRequestContext requestContext;

    private String getOrgId() {
        String orgId = (String) requestContext.getProperty("orgId");
        return orgId != null ? orgId : (String) requestContext.getProperty("businessId");
    }
    @POST
    public Response create(CreateThingRequest req) {
        String role = (String) requestContext.getProperty("role");
        if (!RoleChecker.can(role, RoleChecker.SOME_OPERATION))
            return Response.status(403).entity("{\"message\":\"Forbidden\"}").build();
        String businessId = getOrgId();
        // ... validate, build entity, persist, return 201
    }
}
```

### PATTERN B — New React page
```tsx
// booking-ui/src/pages/ThingPage.tsx
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { getThings } from '../api/thingApi'

export function ThingPage() {
  const { token, orgId } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['things', orgId],
    queryFn: () => getThings(orgId!, token!),
  })
  // ... render
}

// Register in AppRoutes.tsx:
// <Route path="/things" element={<ProtectedRoute requiredRoles={['ADMIN']}><ThingPage /></ProtectedRoute>} />
```

### PATTERN C — New API function (frontend)
```ts
// booking-ui/src/api/thingApi.ts
import axios from 'axios'
import { API_BASE } from './config'

export async function getThings(businessId: string, token: string) {
  const res = await axios.get(`${API_BASE}/things`, {
    params: { businessId },
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.data
}
```

### PATTERN D — Backend integration test
```java
@QuarkusTest
@QuarkusTestResource(MongoTestResource.class)
@TestProfile(SecurityEnabledProfile.class)  // enables JWT validation
class ThingResourceTest {
    @Inject ThingRepository thingRepository;
    @BeforeEach void setUp() { thingRepository.deleteAll(); }

    @Inject AuthService authService;
    @Inject UserRepository userRepository;

    @Test void post_validThing_returns201() {
        // 1. Register org + admin user (no password)
        given().contentType(JSON)
            .body("""{"orgName":"Test","orgSlug":"test","adminEmail":"a@b.com",
                      "adminDisplayName":"Admin"}""")
            .post("/api/v1/auth/register").then().statusCode(201);
        // 2. Generate JWT directly from service
        User user = userRepository.findByEmail("a@b.com").orElseThrow();
        String token = authService.generateUserJwt(user);
        // 3. Call endpoint with Bearer token, assert status + body
    }
}
```

### PATTERN E — Frontend unit test (Vitest + Testing Library)
```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthContext'
import { describe, it, expect, vi } from 'vitest'
vi.mock('../api/thingApi', () => ({ getThings: vi.fn() }))

function renderPage() {
  return render(
    <AuthProvider><MemoryRouter><ThingPage /></MemoryRouter></AuthProvider>
  )
}
describe('ThingPage', () => {
  it('renders heading', () => { renderPage(); expect(screen.getByRole('heading')).toBeDefined() })
})
```

## 10. Running the App

### Start full stack locally
```bash
docker compose up -d                          # MongoDB + Mongo Express
cd booking-api && ./mvnw quarkus:dev          # Backend on :8080
cd booking-ui  && npm install && npm run dev  # Frontend on :5173
```

### Run all tests
```bash
cd booking-api && ./mvnw test                 # Backend unit + integration tests
cd booking-ui  && npm test -- --run            # Frontend Vitest (single run)
cd booking-ui  && npm run test:e2e            # Playwright E2E (needs stack running)
```

### Rebuild after dependency changes
```bash
cd booking-api && ./mvnw clean install -DskipTests
cd booking-ui  && rm -rf node_modules && npm install && npm run build
```

### Deploy to production

Production deploys happen automatically via GitHub Actions on push to `main`.
See `.github/workflows/deploy.yml` for the full pipeline.

**Manual deploy (if needed):**
```bash
# Deploy frontend to Firebase Hosting
cd booking-ui && npm run build && firebase deploy --only hosting

# Deploy backend to Cloud Run (via Artifact Registry)
cd booking-api && ./mvnw package -DskipTests
IMAGE=us-central1-docker.pkg.dev/resale-tracker-pr/booking/booking-api:latest
docker buildx build --platform linux/amd64 -f src/main/docker/Dockerfile.jvm -t $IMAGE .
docker push $IMAGE
gcloud run deploy booking-api --image $IMAGE --region us-central1 --project resale-tracker-pr
```

## 11. Environment Variables

| Variable                              | Purpose                          | Set in                          |
|---------------------------------------|----------------------------------|---------------------------------|
| `quarkus.mongodb.connection-string`   | MongoDB URI                      | application.properties          |
| `quarkus.mongodb.database`            | Database name                    | application.properties          |
| `booking.jwt.secret`                  | HS256 signing key                | application.properties **CHANGE FOR PROD** |
| `booking.jwt.expiry-minutes`          | Access token TTL (default: 15)   | application.properties          |
| `booking.webauthn.rp-id`             | WebAuthn relying party ID        | application.properties          |
| `booking.webauthn.rp-name`           | WebAuthn relying party name      | application.properties          |
| `booking.webauthn.origin`            | Allowed WebAuthn origin          | application.properties          |
| `booking.security.enabled`           | Enable JWT filter (default: true)| application.properties          |
| `QUARKUS_MONGODB_CONNECTION_STRING`   | Override MongoDB URI             | docker-compose.yml              |
| `QUARKUS_MONGODB_DATABASE`            | Override database name           | docker-compose.yml              |
| `VITE_API_URL`                        | Backend URL for frontend         | booking-ui env (optional)       |
| `WEBAUTHN_RP_ID`                      | Production WebAuthn relying party domain (bare domain) | Google Secret Manager |
| `WEBAUTHN_ORIGIN`                     | Production WebAuthn full origin (`https://...`) | Google Secret Manager |
| `CORS_ORIGINS`                        | Comma-separated allowed frontend origins | Google Secret Manager |

## 12. CI/CD Pipeline

All workflow files live in `.github/workflows/`.

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | Pull request → `main` | test-backend, test-frontend, security-scan |
| `deploy.yml` | Push → `main` | test-backend, test-frontend, security-scan → deploy-backend (Cloud Run), deploy-frontend (Firebase) |
| `backup.yml` | Weekly (Sun 04:00 UTC) + manual | mongodump Atlas → GCS bucket |
| `dependabot-automerge.yml` | Dependabot PR (patch only) | auto-merge after CI gate passes |

**Auth:** GitHub ↔ GCP via Workload Identity Federation (WIF). No long-lived JSON keys.
**Secrets at runtime:** Cloud Run pulls from Google Secret Manager (`mongo-uri`, `jwt-secret`, `webauthn-rp-id`, `webauthn-origin`, `cors-origins`).
**Security scanning:** OWASP Dependency Check (backend), npm audit (frontend), Trivy (filesystem). Dependabot: weekly PRs for Maven, npm, and GitHub Actions dependencies; patch updates auto-merge after CI gate; minor/major require manual review.
**GCP bootstrap:** Run `scripts/gcp-setup.sh` once per project to create Artifact Registry, service account, WIF pool, secrets, and GCS backup bucket (idempotent — safe to re-run).

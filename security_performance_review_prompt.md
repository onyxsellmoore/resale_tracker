# Security & Performance Review — Booking Platform

## Context (read before acting)
- Stack: Quarkus 3/Java 25 backend, React 19/TypeScript frontend, MongoDB Atlas
- Auth: Custom JWT (HS256) + WebAuthn passkeys, no passwords
- Multi-tenant: every query must scope by `businessId` from JWT, never from client body
- Rules: TDD always (tests first), default data structure = Set, simplicity over engineering
- Key files: `CONTEXT.md` (full map), `booking-api/src/`, `booking-ui/src/`

---

## Tasks — execute in order

### TASK 1 — Security test additions (TDD: write tests first, then verify they pass)

Add the following tests. Each must be a failing test first, then the fix, then green:

**A. IDOR / Cross-Org Isolation**
- `GET /api/v1/items/{id}` — org B token cannot fetch org A's item (expect 403/404)
- `PATCH /api/v1/items/{id}` — org B token cannot mutate org A's item
- `DELETE /api/v1/items/{id}` — org B token cannot delete org A's item
- `GET /api/v1/sales/{id}` — org B token cannot fetch org A's sale
- Verify these in `CrossOrgIsolationTest` (extend existing if present, create if not)

**B. Role enforcement**
- `POST /api/v1/items` with SELLER role → 403
- `DELETE /api/v1/items/{id}` with BUYER role → 403
- `POST /api/v1/sales` with BUYER role → 403
- `GET /api/v1/analytics` with SELLER role → 403
- `POST /api/v1/users` with SELLER role → 403

**C. Auth endpoint hardening**
- `POST /api/v1/auth/refresh` with revoked token → 401
- `POST /api/v1/auth/refresh` with expired token → 401
- `POST /api/v1/auth/refresh` with malformed/tampered token → 401
- Duplicate registration (same email, same org slug) → 409

**D. Input validation**
- `POST /api/v1/sales` where `platformFees > salePrice` → 400
- `POST /api/v1/sales` where `salePrice <= 0` → 400
- `POST /api/v1/items` where `purchasePrice < 0` → 400
- `PATCH /api/v1/items/{id}` attempting to change `purchasePrice` or `purchaseDate` → 400 (immutability)

**E. businessId injection**
- `POST /api/v1/items` with attacker-supplied `businessId` in body → verify persisted item uses JWT orgId, not body value
- Same for `POST /api/v1/sales`

---

### TASK 2 — Security vulnerability scan and fixes (TDD: red → green for each fix)

Scan every file under `booking-api/src/main/java/` and `booking-ui/src/`. For each vulnerability found, write a failing test exposing it, then fix it. Minimum targets:

1. **IDOR in single-resource GET/PATCH/DELETE** — confirm `ItemResource` and `SaleResource` filter by both `id` AND `businessId` from JWT when fetching by ID. If not, fix it.

2. **businessId mass-assignment** — confirm no endpoint trusts a `businessId`/`orgId` field from the request body when a JWT is present. Fix any that do.

3. **WebAuthn sign-count not enforced** — if `AuthService` does not reject an assertion where `authData.signCount <= storedSignCount`, add the check (authenticator cloning detection).

4. **Refresh token single-use** — confirm token is revoked immediately on use and a new token is issued (rotation). If rotation is missing, add it.

5. **JWT secret strength** — if `application.properties` dev default for `booking.jwt.secret` is weak (< 256 bits / 32 chars), add a startup check that throws on weak secrets when `booking.security.enabled=true`.

6. **Rate limiting on auth** — if `/api/v1/auth/login/begin` and `/api/v1/auth/register` have no rate limiting, add a simple in-memory sliding-window guard (max 10 req/IP/minute) using a `Map<String, Deque<Instant>>`. Use a Quarkus `@ApplicationScoped` bean.

7. **CORS wildcard** — if `CorsFilter` allows `*` or reads from an empty/null config, fix it to fall back to rejecting unknown origins rather than allowing all.

8. **Frontend: JWT in localStorage** — if `AuthContext.tsx` stores the access token in `localStorage`, move it to an in-memory variable (React state / module-level var). Refresh token may stay in an `httpOnly` cookie if the backend supports it, otherwise note the limitation in a comment. Do not break existing auth flow.

9. **Sensitive data in query params** — if any frontend API call passes `token` or credentials as URL query params, move them to `Authorization` headers.

---

### TASK 3 — Efficiency improvements using Sets and Maps

Scan for the following patterns and refactor (no behavior change, tests must still pass):

1. **`hasRole()` linear scan** — `ItemResource`, `SaleResource`, `UserResource`, `AnalyticsResource` each have a `hasRole(String... allowed)` loop. Extract a shared `RoleChecker` utility (or use the existing pattern) and back the allowed-roles lookup with `Set.of(...)` instead of a for-loop. One class, reused everywhere.

2. **Role enum→permission set** — if role permission checks are scattered as repeated string comparisons, create a `RolePermissions` class with a `static final Map<Role, Set<String>>` of allowed operations. Replace inline checks with a single `RolePermissions.can(role, operation)` call.

3. **Platform fee lookup** — if `SaleResource` or `AnalyticsService` iterates a list of platforms to match fees or group results, replace with `Map<String, BigDecimal>` keyed by platform name.

4. **Duplicate credential check** — if `AuthService` checks for existing WebAuthn credentials by iterating a list, replace with a MongoDB `findByCredentialId` query (indexed lookup) or a `Set<String>` of known credential IDs.

5. **Frontend: repeated role checks** — if `AppRoutes.tsx` or page components repeat `role === 'ADMIN' || role === 'SELLER'` inline, extract a `ROLE_PERMISSIONS` map: `Record<string, Set<string>>` where the value is allowed routes/actions for that role.

---

### TASK 4 — Update documentation

After all code changes:

1. **`CONTEXT.md`** — update Section 8 (Engineering Rules) with:
   - "Security — IDOR: single-resource endpoints filter by both `id` AND `businessId` from JWT"
   - "Security — token rotation: refresh tokens are single-use; a new token is issued on each refresh"
   - "Security — rate limiting: auth endpoints are guarded by `AuthRateLimiter` (10 req/IP/min)"
   - Update the Key File Map (Section 7) with any new files created

2. **`booking-api/README.md`** — add a "Security Model" section summarizing: JWT expiry, token rotation, IDOR protection, WebAuthn sign-count enforcement, rate limiting

3. **`booking-regression/README.md`** — add entries for every new test class created

---

## Execution constraints

- **TDD strictly**: for every code change, the test must be written and confirmed failing FIRST, then the fix applied, then confirmed passing.
- **Working code only**: do not leave any file in a broken state. Run `./mvnw test` and `npm test -- --run` before finishing; all tests must be green.
- **No over-engineering**: prefer the simplest fix. If a vulnerability requires more than ~30 lines to fix correctly, note it as a finding in `CONTEXT.md` under a new "## Known Security Findings" section with a remediation plan instead of introducing complex code.
- **Sets as default**: per project rules, use `Set`/`HashSet` wherever a collection is unordered and uniqueness matters; use `List` only where order is required for UI rendering.
- **Money safety**: never use `float`/`double` for monetary values. All new code uses `BigDecimal`.
- **Preserve immutability**: `purchasePrice` and `purchaseDate` must remain immutable after item creation.

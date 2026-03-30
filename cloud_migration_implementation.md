# Cloud Migration Implementation Plan — Booking Platform

**Date:** 2026-03-20
**Status:** Draft — ready for team review
**Author:** Principal Engineering

---

## 1. Why Migrate?

Right now, the platform runs entirely on a single machine via Docker Compose. That means:

- If the machine goes down, the app goes down.
- Accessing the app from anywhere other than that machine requires extra network setup.
- There is no path to mobile apps sharing the same data.
- Backups, SSL certificates, and uptime are all manual burdens.

Moving to the cloud solves all of these at **zero ongoing cost** by using the permanent free tiers of three services that were specifically designed to handle small workloads at no charge.

---

## 2. Provider Comparison — AWS vs. Azure vs. GCP

Before committing to a platform, all three major cloud providers were evaluated against three criteria: permanently free compute for the Quarkus container, permanently free static hosting for the React app, and a permanently free database that avoids rewriting the data layer.

### Compute (backend API)

| Provider | Service | Free? | Notes |
|---|---|---|---|
| **AWS** | EC2 t2.micro | ⚠️ 12 months only | Expires; not viable for zero-budget long-term |
| **AWS** | Lambda | ✅ 1M req/month forever | Requires Quarkus Lambda adapter — code changes needed to convert the JAX-RS server to a Lambda handler |
| **AWS** | ECS / Fargate | ❌ No free tier | Costs from first container |
| **Azure** | Container Apps | ✅ 180k vCPU-sec/month forever | Scales to zero; directly comparable to Cloud Run |
| **Azure** | Functions | ✅ 1M exec/month forever | Same trade-off as Lambda: requires restructuring Quarkus as a function handler |
| **GCP** | Cloud Run ✓ | ✅ 2M req/month forever | Scales to zero; takes the existing Docker image as-is — no code changes |

**Winner: GCP Cloud Run.** It is the only permanently free compute service that runs the existing Docker container without code changes. Azure Container Apps is a close second but has a smaller free compute budget. AWS has no permanently free container service.

### Frontend (React static build)

| Provider | Service | Free Bandwidth | Notes |
|---|---|---|---|
| **AWS** | S3 + CloudFront | ✅ 1 TB/month CloudFront (permanent) | S3 storage only free for 12 months (~$0.0001/month after — negligible for a 5 MB app) |
| **Azure** | Static Web Apps | ✅ Unlimited bandwidth | Built-in GitHub Actions CI/CD, 2 custom domains |
| **GCP** | Firebase Hosting ✓ | ✅ ~10 GB/month | Lower cap than Azure, but includes the Firebase mobile ecosystem |

**Winner: Tied between Azure Static Web Apps and Firebase Hosting.** Azure has unlimited bandwidth. Firebase wins on mobile ecosystem — Firebase Cloud Messaging (push notifications), App Distribution (beta builds), and Analytics work across web and mobile from the same dashboard. For a team planning a mobile app, Firebase's ecosystem value outweighs Azure's bandwidth advantage.

### Database (zero-rewrite constraint)

The codebase uses MongoDB via Panache, so any replacement must speak the MongoDB wire protocol natively — otherwise every query in the backend has to be rewritten.

| Provider | Service | Free Storage | MongoDB-Compatible? | Notes |
|---|---|---|---|---|
| **AWS** | DynamoDB | 25 GB | ❌ No | Different query model entirely; complete data layer rewrite required |
| **AWS** | DocumentDB | ❌ No free tier | Partial | Costs from first instance |
| **Azure** | Cosmos DB for MongoDB | ✅ **25 GB** | ✅ Mostly | API-compatible but has documented gaps (see below) |
| **GCP** | Firestore | 1 GB | ❌ No | Different data model; complete data layer rewrite required |
| **MongoDB Atlas M0** (any cloud) | — | ✅ 512 MB | ✅ Fully | Identical engine; zero code changes |

**Azure Cosmos DB for MongoDB deserves serious attention.** At 25 GB free versus Atlas's 512 MB, it is 50× more generous on storage. However, Cosmos DB's MongoDB compatibility is not complete — known gaps include certain aggregation pipeline stages, cross-document transactions, and some index types. The existing codebase would need to be tested carefully, and any incompatibilities would require workarounds. For a codebase that hasn't been audited against Cosmos DB, this introduces risk that Atlas M0 does not.

**Winner: MongoDB Atlas M0** for zero-risk deployment. The entire existing test suite runs against it unchanged. If storage becomes a constraint later (not expected for years at current scale), migrating from Atlas to Cosmos DB is a viable upgrade path at that time with a known scope of work.

### Summary Decision

| Layer | Winner | Runner-up |
|---|---|---|
| Database | MongoDB Atlas M0 (full compatibility) | Azure Cosmos DB for MongoDB (more storage, some risk) |
| Backend | GCP Cloud Run (no code changes) | Azure Container Apps (close second) |
| Frontend | Firebase Hosting (mobile ecosystem) | Azure Static Web Apps (unlimited bandwidth) |

All three layers favor GCP/Firebase as a cohesive stack. The one genuine Azure advantage — Cosmos DB storage — is not a near-term concern at current scale.

---

## 3. Chosen Platform — Quick Reference

| What | Current | Cloud Replacement | Why Free Stays Free |
|---|---|---|---|
| **Database** | MongoDB in Docker | **MongoDB Atlas M0** | Permanent free tier, 512 MB storage |
| **Backend API** | Quarkus on local machine | **Google Cloud Run** | 2 million free requests/month; scales to zero when idle |
| **Frontend (React)** | Vite dev server / local build | **Firebase Hosting** | 10 GB storage, ~10 GB/month transfer; no charge for static files |
| **Secrets** | `application.properties` file | **Google Secret Manager** | 6 active secret versions free, 10,000 lookups/month free — fits our 5 secrets comfortably; rotate one at a time to stay within limit |
| **Container registry** | N/A | **GCP Artifact Registry** | 0.5 GB free storage for Docker images |

**Total expected monthly cloud bill: $0.00** under normal small-business usage.

---

## 4. Database — MongoDB Atlas M0

### What is it?

MongoDB Atlas is MongoDB's own hosted service. The M0 tier is their permanent free cluster — it never expires and never charges you.

### Why Atlas instead of Firestore?

The current codebase uses MongoDB with a library called Panache, which handles all database queries. Switching to Firestore (Google's alternative) would require **rewriting every single database query** in the backend — a large, risky undertaking with no benefit to the business. Atlas is simply a hosted version of the same database already in use.

### What you get for free

- 512 MB of storage (comfortably holds hundreds of thousands of inventory items and sales records — a typical Item document is ~300 bytes in BSON, so 512 MB fits roughly 1.5 million items even accounting for indexes)
- Built-in monitoring dashboard
- Connection from anywhere over TLS (encrypted)

**What is not included on the free tier:** Automatic backups and high-availability failover. M0 is a shared cluster — MongoDB manages the hardware but makes no uptime SLA commitment. For a small business this is acceptable; see Section 9 for the manual backup strategy.

### What changes in the code

Almost nothing. The only change is the MongoDB connection string in `application.properties`:

**Before (local Docker):**
```
quarkus.mongodb.connection-string=mongodb://localhost:27017
```

**After (Atlas):**
```
quarkus.mongodb.connection-string=${MONGO_CONNECTION_STRING}
```

The actual connection string (which contains a username and password) is stored in Google Secret Manager and injected into the app at runtime — never committed to version control.

### Data migration

Migrate existing data once using MongoDB's official export/import tools:

```bash
# Export from local Docker
mongodump --uri="mongodb://localhost:27017" --db=booking --out=./backup

# Import into Atlas (connection string from Atlas dashboard)
mongorestore --uri="<atlas-connection-string>" --db=booking ./backup/booking
```

### IP allowlist note

Cloud Run (the backend) does not have a fixed IP address. Atlas M0 supports allowing all IPs (`0.0.0.0/0`), which is acceptable here because the database requires a username and password to connect — the IP allowlist is a secondary layer. For a future upgrade, a static IP can be obtained if the business grows.

### How Atlas integrates with the GCP stack

This is a fair concern: Atlas is a third-party service from MongoDB, Inc. — not a native GCP product. Here is why this works cleanly and is not a "patchwork" architecture:

**Same cloud, same region.** When creating an Atlas M0 cluster, you choose both the cloud provider (AWS, GCP, or Azure) and the region. By choosing **GCP + us-central1**, the Atlas cluster physically lives in Google's Iowa data center — the same data center Cloud Run deploys to. Traffic between Cloud Run and Atlas travels over Google's internal fiber network, not the public internet. This is typically under 5ms of latency per query.

```
[User's browser]
      │  HTTPS
      ▼
[Firebase Hosting CDN]  ──HTTPS──►  [Cloud Run — us-central1]
                                              │
                                       MongoDB wire protocol
                                       (TLS, same GCP network)
                                              │
                                              ▼
                                    [Atlas M0 — GCP us-central1]
```

**This is the intended deployment model.** MongoDB Atlas was built specifically to be accessed from cloud-hosted applications. This is not a workaround — the majority of Atlas customers run their compute on one of the three major clouds and point it at Atlas in the same region. The Quarkus/Panache MongoDB driver is designed for exactly this pattern.

**What "same region, same cloud" actually means in practice:**

- The database connection string is the only coupling between the two services.
- Quarkus connects at startup, keeps a connection pool open, and reuses it across requests — identical to local Docker, just a different hostname.
- TLS is enforced by Atlas by default; no extra configuration required.
- There are no GCP-specific networking components to set up (no VPC peering, no private service connect) at this scale. Those exist as upgrade paths if the business grows and wants a stricter security boundary.

**Why not use a GCP-native database instead?** Firestore is GCP's native document database and would have tighter integration (no cross-service network hop at all). However, it uses a completely different query API — switching would require rewriting every repository method in the backend. The architectural benefit of tighter GCP integration is not worth the migration risk and effort. Atlas on GCP is the right trade-off: same-region performance with zero code changes.

### Mobile integration

The Quarkus REST API is the mobile integration point — no database SDK changes needed. A React Native mobile app calls the same `/api/v1/items`, `/api/v1/sales`, and auth endpoints as the web app. Because the data lives in Atlas, every platform sees the same records in real time.

---

## 5. Backend API — Google Cloud Run

### What is it?

Cloud Run is Google's managed container service. You give it a Docker image of the Quarkus app and it runs it. When no one is making requests, it scales down to zero running instances — meaning zero cost. When a request arrives, it spins up in seconds.

### Why Cloud Run over alternatives?

| Option | Problem |
|---|---|
| **Render (free tier)** | Services sleep after 15 minutes of inactivity; cold starts can take 30+ seconds |
| **Railway (free tier)** | Only 500 hours/month — not enough for a always-reachable service |
| **Fly.io (free tier)** | Good option, but GCP ecosystem gives better integration with Firebase Hosting and Secret Manager already chosen |
| **Google Cloud Run ✓** | 2 million free requests/month, cold start under 2 seconds with Quarkus native image, integrates natively with GCP secrets |

### Free tier breakdown

- **2,000,000 requests/month** free
- **360,000 GB-seconds** of memory free
- **180,000 vCPU-seconds** free

A small resale business making 10,000 API calls per day would use ~300,000 requests/month — well within the free tier.

### Reducing cold start time

Cloud Run scales to zero, which means the first request after a quiet period takes slightly longer (a "cold start"). Quarkus solves this with a **native image build** — instead of running Java bytecode, it compiles the app to a native binary. This reduces cold start time from ~5 seconds to under 1 second.

Build command addition to the Maven pipeline:

```bash
./mvnw package -Pnative -Dquarkus.native.container-build=true
```

This produces a small Linux binary that Cloud Run starts almost instantly.

### Deployment process

1. Build the Docker image locally or in CI
2. Push to GCP Artifact Registry (free 0.5 GB)
3. Deploy to Cloud Run with a single command:

```bash
# Push image to Artifact Registry first
docker tag booking-api us-central1-docker.pkg.dev/PROJECT_ID/booking/booking-api:latest
docker push us-central1-docker.pkg.dev/PROJECT_ID/booking/booking-api:latest

# Deploy to Cloud Run
gcloud run deploy booking-api \
  --image us-central1-docker.pkg.dev/PROJECT_ID/booking/booking-api:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets MONGO_CONNECTION_STRING=mongo-uri:latest,JWT_SECRET=jwt-secret:latest
```

Note: `--allow-unauthenticated` applies to Cloud Run's own IAM gate — this is correct for a public API. The app's own JWT security filter is what actually protects every route.

### Configuration changes

The following environment variables replace hardcoded values in `application.properties`. They are injected from Google Secret Manager at deploy time:

| Variable | What it holds |
|---|---|
| `MONGO_CONNECTION_STRING` | Full Atlas connection URI with credentials |
| `JWT_SECRET` | The HS256 signing key (must be changed from dev default) |
| `WEBAUTHN_RP_ID` | Production domain (e.g., `app.yourdomain.com`) |
| `WEBAUTHN_ORIGIN` | Full origin (e.g., `https://app.yourdomain.com`) |
| `CORS_ORIGINS` | Firebase Hosting URL for the frontend |

### WebAuthn / Passkey note

WebAuthn passkeys are tied to a domain name (the "relying party ID"). Once the app moves to a production domain, all existing passkey registrations become invalid — users will need to re-register their passkey. This is a one-time migration event that should be communicated to users in advance. Going forward, passkeys work identically in the cloud.

---

## 6. Frontend — Firebase Hosting

### What is it?

Firebase Hosting serves static files (HTML, CSS, JavaScript) from Google's global CDN. The Vite build output (`npm run build`) is a folder of static files — Firebase Hosting serves those files to users around the world.

### Why Firebase Hosting over alternatives?

Netlify and Cloudflare Pages are also excellent free options for static hosting. Firebase Hosting is chosen here specifically because of the **mobile future**:

- Firebase is the standard toolkit for mobile app development on both iOS (via Swift SDK) and Android (via Kotlin SDK)
- Firebase Cloud Messaging (FCM) provides free push notifications for mobile
- Firebase App Distribution makes it easy to send beta builds to testers
- Firebase Analytics is free and works across web and mobile
- Being already in the Firebase/GCP ecosystem means one account, one billing dashboard, and shared configuration

When the mobile app is built, Firebase is already there and already configured.

### Free tier

- 10 GB storage (the built React app is typically under 5 MB)
- ~10 GB/month bandwidth (approximately 100,000 page loads per month for a typical SPA)
- Custom domain with automatic SSL certificate — free
- Multiple preview channels (for staging/testing) — free

### Deployment

```bash
# One-time setup
npm install -g firebase-tools
firebase login
firebase init hosting  # Point to booking-ui/dist

# Every deploy
cd booking-ui && npm run build
firebase deploy --only hosting
```

### Configuration change

The frontend needs to know the Cloud Run backend URL. Update the `.env.production` file:

```
VITE_API_URL=https://booking-api-<hash>-uc.a.run.app
```

Or better, set a custom domain on Cloud Run as well so the URL is stable.

---

## 7. Mobile Strategy (Future Phase)

The platform choices above were made to make mobile as easy as possible when the time comes.

### Recommended approach: React Native with Expo

React Native allows writing one codebase that runs on both iOS and Android. Because the web app is already built in React, the team's existing React knowledge transfers directly.

**What can be reused from the web app:**
- All API call functions (`inventoryApi.ts`, `salesApi.ts`, etc.) — unchanged
- Business logic and data types — unchanged
- The same backend REST API — no backend changes needed

**What needs to be rebuilt for mobile:**
- The UI layer (React Native components instead of HTML/CSS)
- Navigation (React Navigation instead of React Router)
- Passkey/biometric login (using device Face ID / fingerprint via `react-native-passkey` library)

### Account sync across platforms

Because all data lives in MongoDB Atlas and authentication is handled by the Quarkus backend, accounts and data are already synchronized by design. A user who logs in on web and then logs in on mobile sees the same inventory and sales — there is nothing extra to build for sync.

### Push notifications

Firebase Cloud Messaging (FCM) is free and works on both iOS and Android. When the mobile app is built, adding low-stock alerts or sale confirmations becomes a matter of:

1. Registering the device token when the app opens (one API endpoint)
2. Sending a push notification from the backend when an event occurs (one Firebase SDK call)

---

## 8. Migration Phases

### Phase 1 — Database (Low risk, highest impact)

1. Create a free MongoDB Atlas account at `cloud.mongodb.com`
2. Create an M0 cluster (choose a region close to your users)
3. Create a database user with a strong password
4. Run `mongodump` / `mongorestore` to migrate existing data
5. Update `application.properties` locally to point at Atlas
6. Run the full test suite (`./mvnw test`) — all tests should pass without code changes
7. Verify the app works locally with the Atlas connection
8. Store the Atlas connection string in Google Secret Manager

**Rollback:** Switch connection string back to local Docker. No data changes on the local side.

### Phase 2 — Backend (Medium complexity)

1. Set up a GCP project (free)
2. Enable Cloud Run, Artifact Registry, and Secret Manager APIs
3. Add the Quarkus container image extension to `pom.xml`
4. Build and push the Docker image to Artifact Registry
5. Deploy to Cloud Run with secrets injected from Secret Manager
6. Test all API endpoints against the deployed Cloud Run URL
7. Update `VITE_API_URL` in the frontend to point at Cloud Run

**Rollback:** The local Docker Compose stack still works. Revert `VITE_API_URL`.

### Phase 3 — Frontend (Low risk)

1. Set up Firebase project (same Google account as GCP)
2. Run `firebase init hosting` in `booking-ui/`
3. Build and deploy: `npm run build && firebase deploy`
4. Set up custom domain in Firebase console (optional, recommended)
5. Update WebAuthn origin in Cloud Run environment variables to match the Firebase domain
6. Notify users to re-register passkeys (one-time)

**Rollback:** Serve the build locally or via any simple static host.

### Phase 4 — CI/CD (Quality of life)

Set up GitHub Actions to automatically build and deploy on every push to `main`:

```yaml
# .github/workflows/deploy.yml  (simplified outline — expand with GCP auth steps)
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2        # uses GCP service account secret
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - run: ./mvnw package -Pnative -Dquarkus.native.container-build=true
      - run: docker build -f src/main/docker/Dockerfile.native -t booking-api .
      - run: |
          docker push us-central1-docker.pkg.dev/$PROJECT_ID/booking/booking-api:latest
          gcloud run deploy booking-api --image us-central1-docker.pkg.dev/$PROJECT_ID/booking/booking-api:latest --region us-central1
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd booking-ui && npm ci && npm run build
      - run: firebase deploy --only hosting --token ${{ secrets.FIREBASE_TOKEN }}
```

GitHub Actions free tier provides 2,000 minutes/month for private repositories. Native Quarkus builds take roughly 10–15 minutes each — at 30 deploys/month that is ~450 minutes, leaving comfortable headroom.

---

## 9. Cost Analysis

### Free tier limits vs. expected usage

| Resource | Free Limit | Expected Usage | Headroom |
|---|---|---|---|
| Atlas M0 storage | 512 MB | ~0.3 MB/1,000 items (with indexes) | Room for ~1.5 million items |
| Cloud Run requests | 2,000,000/month | ~50,000/month (active team of 5) | 97% headroom |
| Cloud Run compute | 360,000 GB-seconds | ~10,000 GB-seconds | 97% headroom |
| Firebase Hosting bandwidth | ~10 GB/month | ~500 MB/month | 95% headroom |
| Secret Manager | 6 active versions, 10k lookups | 5 active versions, ~500 lookups | 1 version of headroom; rotate cleanly |
| GitHub Actions | 2,000 min/month | ~450 min/month (30 deploys × ~15 min native build) | 77% headroom |

**When would costs start?** Only if the business scales significantly — roughly at 50+ active daily users making hundreds of API calls each. At that point, the business is large enough that the cost (fractions of a cent per additional request) would be trivial relative to revenue.

### What is never free (and how we avoid it)

- **Backups on Atlas M0:** Not included. Mitigate with a weekly `mongodump` script run via a free GitHub Actions cron job that stores the dump in a free-tier Google Cloud Storage bucket (5 GB free).
- **Static outbound IPs:** Cloud Run shares IPs. Atlas M0 requires open IP allowlist as a result. Acceptable given password + TLS authentication.
- **SLA guarantees:** Free tiers have no uptime SLA. Acceptable for a small business. Atlas M0 historically maintains 99%+ uptime.

---

## 10. Security Checklist for Production

Before go-live, confirm the following:

- [ ] JWT secret rotated from the development default and stored in Secret Manager (not in `application.properties`)
- [ ] MongoDB Atlas user has minimum required permissions (readWrite on the `booking` database only)
- [ ] MongoDB Atlas IP allowlist set as restrictively as possible (or use all-IPs + auth)
- [ ] `booking.security.enabled=true` in all production environment variables
- [ ] WebAuthn `rp-id` and `origin` set to the production domain — not `localhost`
- [ ] CORS in `application.properties` set to the Firebase Hosting domain only
- [ ] No secrets committed to version control (verify with `git log --all -S "secret"`)
- [ ] Cloud Run service not set to `--allow-unauthenticated` for internal-only endpoints (the current setup allows unauthenticated requests to Cloud Run, relying on the app's own JWT validation — this is correct and intentional)

---

## 11. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Atlas M0 storage fills up (512 MB limit) | Low | Medium | Weekly export cron job to GCS; monitor Atlas storage dashboard monthly |
| Cloud Run cold start delays UX | Low | Low | Native image build reduces cold start to <1s; set minimum 1 instance if budget allows later |
| Firebase Hosting bandwidth exceeded | Very Low | Low | ~10 GB/month is large for a small team; upgrade to Blaze (pay-as-you-go) only if truly needed |
| Passkey re-registration friction | Certain (one-time) | Low | Communicate change to all users 1 week in advance; provide clear re-registration instructions |
| Free tier policy changes | Very Low | High | MongoDB Atlas M0, Cloud Run free tier, and Firebase Spark plan have been stable for 5+ years; monitor announcements |
| Native image build breaks a feature | Medium | Medium | Test native build in staging before production; fall back to JVM image if needed |

---

## 12. Summary

This migration moves the platform from a single machine to a resilient, cloud-hosted platform at zero cost by using services that are purpose-built for small-scale workloads:

- **MongoDB Atlas M0** replaces the Docker MongoDB container with zero code changes — it is the same database engine, just hosted for you.
- **Google Cloud Run** hosts the Quarkus backend as a Docker container, scales to zero when idle (no cost), and spins up in under a second with a native build.
- **Firebase Hosting** serves the React app as static files from a global CDN, and provides the ecosystem foundation for a future mobile app.

The migration is designed to be done in phases, with each phase independently reversible. No code changes are required for Phase 1 (database). Minor configuration changes (environment variables and build flags) cover Phases 2 and 3. The mobile path is clear: React Native reuses the existing API layer, Firebase provides push notifications and analytics, and Atlas syncs data across all platforms automatically.

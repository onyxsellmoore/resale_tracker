# CI/CD Pipeline — TAV Booking Platform

## Read these files before acting
```
CONTEXT.md                                                  — full domain + engineering rules
docker-compose.yml                                          — Task 0 target
booking-api/pom.xml                                         — before adding dependencies
booking-ui/package.json                                     — before adding scripts
booking-api/src/main/docker/Dockerfile.jvm                  — verify build context path
firebase.json + .firebaserc                                 — confirm project name/rewrites
booking-api/README.md                                       — before appending CI/CD section
booking-ui/README.md                                        — before appending CI/CD section
```

## Context
- Stack: Quarkus 3/Java 25 (Maven), React 19/TypeScript (Vite), MongoDB Atlas M0
- Deploy: Docker → GCP Artifact Registry → Cloud Run `resales-tracker` us-central1 (backend);
  Vite build → Firebase Hosting `resales-tracker` (frontend)
- Runtime secrets in Google Secret Manager: `mongo-uri`, `jwt-secret`, `webauthn-rp-id`,
  `webauthn-origin`, `cors-origins` — Cloud Run reads them at startup via `--set-secrets`.
  GitHub Actions must NEVER inject application secrets.
- Tests: `./mvnw test` (BE) · `npm test -- --run` (FE Vitest) · `npm run test:e2e` (Playwright)
- Rules: simplicity first; no composite actions unless saving ≥20 lines; JVM image not native

---

## TASK 0 — Remove MailHog (complete before pipeline work)

MailHog is infrastructure-only noise — no Java mailer code, no `quarkus-mailer` dependency,
no SMTP config exists. Remove it from config and docs; leave all `email.trim()` frontend
validation calls untouched.

**`docker-compose.yml`** — read the file first, then:
- Delete the `mailhog:` service block entirely
- Remove any `depends_on: mailhog` entries in other services
- Add one comment above the `mongodb:` service:
  `# Email: MailHog removed. Future: Resend/SendGrid API or FCM for push when notifications are built.`

**Docs** — remove every `mailhog`/`MailHog` reference from:
`CONTEXT.md` (Section 2 tech stack row, Section 7 file map line, Section 10 startup comment),
`README.md` (root), `booking-api/README.md`, `booking-ui/README.md`

**Do NOT touch:** `email.trim()` calls in any `.tsx`/`.ts` file; any `.html` archive files.

**Verify:**
```bash
docker compose config                    # must parse cleanly
grep -ri mailhog . --include="*.yml" --include="*.md"  # must return zero results
./mvnw test -B --no-transfer-progress    # all tests still green
npm --prefix booking-ui test -- --run   # all tests still green
```

---

## Deliverables (Tasks 1–5 create these; Task 6 updates docs)
```
.github/workflows/ci.yml              — PR gate: test + scan, no deploy
.github/workflows/deploy.yml          — push to main: same gates + deploy
.github/workflows/backup.yml          — weekly Atlas dump → GCS
.github/owasp-suppressions.xml        — empty suppression file (valid XML skeleton)
scripts/gcp-setup.sh                  — idempotent one-time GCP bootstrap
booking-ui/.env.production.example    — VITE_API_URL template only
```

---

## TASK 1 — `.github/workflows/ci.yml`

Trigger: `pull_request` → `main`

Three jobs. `test-backend` and `test-frontend` run in parallel; `security-scan` has
`needs: [test-backend, test-frontend]`.

**`test-backend`**
- `actions/checkout@v4`
- `actions/setup-java@v4` — Java 25, Temurin, `cache: maven`
- `./mvnw test -B --no-transfer-progress` (Quarkus test resource starts embedded Mongo)
- Upload surefire XML on failure

**`test-frontend`**
- `actions/checkout@v4`
- `actions/setup-node@v4` — Node 22, `cache: npm`, `cache-dependency-path: booking-ui/package-lock.json`
- `cd booking-ui && npm ci`
- Check whether `type-check` script exists in `package.json`; add `"type-check": "tsc --noEmit"` if missing
- `npm run type-check`
- `npm test -- --run`
- Upload results on failure

**`security-scan`**
- Checkout + restore both maven and npm caches
- `./mvnw org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=7 -Dformats=HTML,JSON -DsuppressionFile=.github/owasp-suppressions.xml`
  - Before running: verify OWASP plugin is in `pom.xml`; add it if missing (version 10.0.4,
    `failBuildOnCVSS=7`, suppression file path as above)
- Upload `dependency-check-report.html` as artifact
- `cd booking-ui && npm ci`
- `npm audit --audit-level=high --json > npm-audit.json || true`
- `jq -e '.metadata.vulnerabilities | .high + .critical == 0' npm-audit.json` — non-zero exit fails job
- Upload `npm-audit.json` as artifact

---

## TASK 2 — `.github/workflows/deploy.yml`

Trigger: `push` → `main`

**Jobs `test-backend`, `test-frontend`, `security-scan`** — identical to `ci.yml`. Duplicate
them; do not abstract into composite actions.

**`build-and-scan-image`** `needs: [security-scan]`
- Checkout + setup-java (Java 25, Temurin, maven cache)
- Read `pom.xml` to confirm `quarkus-smallrye-health` dependency exists; add it if missing
  (needed for the smoke test's `/q/health` call)
- `./mvnw package -DskipTests -B --no-transfer-progress`
- Read `booking-api/src/main/docker/Dockerfile.jvm` to confirm build context, then:
  ```
  docker build --platform linux/amd64 \
    -f booking-api/src/main/docker/Dockerfile.jvm \
    -t booking-api:${{ github.sha }} booking-api/
  ```
- `aquasecurity/trivy-action@master` — `image-ref: booking-api:${{ github.sha }}`,
  `exit-code: 1`, `severity: CRITICAL,HIGH`, `ignore-unfixed: true`
- Upload trivy report as artifact on failure

**`deploy-backend`** `needs: [build-and-scan-image]`
- `google-github-actions/auth@v2` with WIF (preferred):
  `workload_identity_provider: ${{ secrets.WIF_PROVIDER }}`
  `service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}`
  Fallback if WIF not configured: `credentials_json: ${{ secrets.GCP_SA_KEY }}`
- `google-github-actions/setup-gcloud@v2`
- `gcloud auth configure-docker us-central1-docker.pkg.dev --quiet`
- Tag + push:
  ```
  REGISTRY=us-central1-docker.pkg.dev/resales-tracker/booking/booking-api
  docker tag booking-api:${{ github.sha }} $REGISTRY:${{ github.sha }}
  docker tag booking-api:${{ github.sha }} $REGISTRY:latest
  docker push $REGISTRY:${{ github.sha }}
  docker push $REGISTRY:latest
  ```
- Deploy:
  ```
  gcloud run deploy booking-api \
    --image $REGISTRY:${{ github.sha }} \
    --platform managed --region us-central1 --project resales-tracker \
    --allow-unauthenticated \
    --set-secrets MONGO_CONNECTION_STRING=mongo-uri:latest,JWT_SECRET=jwt-secret:latest,\
  WEBAUTHN_RP_ID=webauthn-rp-id:latest,WEBAUTHN_ORIGIN=webauthn-origin:latest,\
  CORS_ORIGINS=cors-origins:latest --quiet
  ```
- Smoke test (retry 5×, 3s delay):
  ```
  curl --fail --retry 5 --retry-delay 3 \
    $(gcloud run services describe booking-api --region us-central1 \
      --format 'value(status.url)')/q/health
  ```

**`deploy-frontend`** `needs: [test-frontend, security-scan]` (independent of backend jobs)
- Checkout + setup-node (Node 22, npm cache)
- `cd booking-ui && npm ci`
- Check whether `test:e2e` script exists in `package.json`; add `"test:e2e": "playwright test"` if missing
- `echo "VITE_API_URL=${{ vars.VITE_API_URL }}" > booking-ui/.env.production`
  (`vars.` not `secrets.` — this URL is not sensitive)
- `npm run build`
- `npm install -g firebase-tools`
- `firebase deploy --only hosting --token "${{ secrets.FIREBASE_TOKEN }}" --project resales-tracker --non-interactive`

---

## TASK 3 — `.github/workflows/backup.yml`

Triggers: `schedule: '0 2 * * 0'` (Sunday 2am UTC) + `workflow_dispatch`

Single job `atlas-backup`:
- Auth to GCP (same WIF or `GCP_SA_KEY` as deploy.yml)
- `sudo apt-get install -y mongodb-database-tools`
- Fetch URI: `MONGO_URI=$(gcloud secrets versions access latest --secret=mongo-uri --project=resales-tracker)`
- `DATE=$(date +%Y-%m-%d)`
- `mongodump --uri="$MONGO_URI" --db=booking --archive=/tmp/booking-$DATE.gz --gzip`
- `gsutil cp /tmp/booking-$DATE.gz gs://tav-backups/booking-$DATE.gz`
- Prune to 13 most recent (90-day window):
  `gsutil ls gs://tav-backups/ | grep booking- | sort | head -n -13 | xargs -r gsutil rm`
- On failure emit `::error::Atlas backup failed` annotation

---

## TASK 4 — `scripts/gcp-setup.sh`

Idempotent bootstrap; safe to run multiple times. Use `2>/dev/null || true` on every
create command. Script must be executable (`chmod +x`).

Steps in order:
1. Enable APIs: `run`, `artifactregistry`, `secretmanager`, `storage`, `iamcredentials`
   on project `resales-tracker`
2. Create Artifact Registry repo `booking` (docker, us-central1) if absent
3. Create GCS bucket `gs://tav-backups` (us-central1) if absent
4. Create SA `github-actions@resales-tracker.iam.gserviceaccount.com` if absent; bind roles:
   `run.admin`, `artifactregistry.writer`, `secretmanager.secretAccessor`,
   `storage.objectAdmin`, `iam.serviceAccountUser`
5. Create WIF pool `github-pool` (global) if absent
6. Create OIDC provider `github-provider` in that pool with:
   `issuer-uri: https://token.actions.githubusercontent.com`
   `attribute-mapping: "google.subject=assertion.sub,attribute.repository=assertion.repository"`
7. Bind SA to repo principal — set `REPO="ORG/REPO"` as a variable the user must edit
   at the top of the script with a `# EDIT THIS` comment
8. Print a clearly formatted summary of every GitHub secret/variable value the developer
   must add, computing `WIF_PROVIDER` from the live project number

---

## TASK 5 — `booking-ui/.env.production.example`

One line only (no extra comments needed — the file name is self-explanatory):
```
VITE_API_URL=https://booking-api-<hash>-uc.a.run.app
```

---

## TASK 6 — Documentation updates

Read each file before editing it.

**`CONTEXT.md` — add Section 12** describing: the three workflows and their triggers,
which jobs are required PR status checks, GitHub secrets vs variables vs Secret Manager
split, the five security gates that must pass before any deploy, the E2E caveat
(Playwright runs locally only until a staging environment exists), and the note that
native Quarkus image is a future CI optimization. Write in prose + one table — no
fenced markdown blocks inside the section.

**`CONTEXT.md` Section 10 "Deploy to production"** — rewrite to exactly mirror the
`deploy.yml` workflow: same `Dockerfile.jvm` path, same `--platform linux/amd64` flag,
same `--set-secrets` list and secret names, same `firebase deploy` flags. A developer
running the commands manually must produce an identical result to the pipeline.

**`booking-api/README.md`** — append a "CI/CD" section: what triggers a backend deploy,
the five gate jobs, smoke test URL pattern, and how to run the full pipeline locally
(the same `./mvnw` + `docker build` + `gcloud run deploy` sequence from Section 10).

**`booking-ui/README.md`** — append a "CI/CD" section: what triggers a frontend deploy,
the `VITE_API_URL` variable (where to set it in GitHub, why it's `vars.` not `secrets.`),
and the manual deploy sequence.

---

## Execution constraints

- **Valid YAML**: Run `actionlint` on all workflow files before finishing. Zero errors required.
- **No bare secrets**: `git grep -rn "SECRET\|PASSWORD\|TOKEN\|PRIVATE_KEY" .github/` must
  return only `${{ secrets.* }}` or `${{ vars.* }}` references — never literal values.
- **`vars.` vs `secrets.`**: `VITE_API_URL` is a GitHub Actions *variable*, not a secret.
  Use `${{ vars.VITE_API_URL }}` everywhere.
- **No source edits**: Do not modify any `.java`, `.tsx`, `.ts`, or `application.properties`
  files. `pom.xml` and `package.json` are the only source-adjacent files this task touches,
  and only to add missing entries.
- **Task 0 exception**: `docker-compose.yml` is modified only in Task 0 (MailHog removal).
  No further changes to it in Tasks 1–6.
- **Docs must match pipeline**: Any command shown in a README or CONTEXT.md that also
  appears in a workflow YAML must be identical — same flags, same paths, same order.

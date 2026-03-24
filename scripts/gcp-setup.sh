#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Idempotent GCP bootstrap for TAV Booking Platform
# Run once per project (safe to re-run — all commands are idempotent).
# Prerequisites: gcloud CLI authenticated, billing enabled.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT="resales-tracker"
REGION="us-central1"
AR_REPO="booking"
SA_NAME="github-deploy"
WIF_POOL="github-pool"
WIF_PROVIDER="github-provider"
GITHUB_ORG="jaredmoore"          # ← update to your GitHub org/username
GITHUB_REPO="tav-booking"        # ← update to your repo name
GCS_BUCKET="gs://${PROJECT}-backups"

echo "▸ Setting project to ${PROJECT}..."
gcloud config set project "${PROJECT}"

# ── Enable APIs ──────────────────────────────────────────────
echo "▸ Enabling APIs..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  cloudresourcemanager.googleapis.com \
  storage.googleapis.com \
  --quiet

# ── Artifact Registry ───────────────────────────────────────
echo "▸ Creating Artifact Registry repo (if needed)..."
gcloud artifacts repositories describe "${AR_REPO}" \
  --location="${REGION}" --format="value(name)" 2>/dev/null \
|| gcloud artifacts repositories create "${AR_REPO}" \
  --repository-format=docker \
  --location="${REGION}" \
  --description="TAV Booking Docker images" \
  --quiet

# ── Service Account ─────────────────────────────────────────
echo "▸ Creating service account (if needed)..."
gcloud iam service-accounts describe \
  "${SA_NAME}@${PROJECT}.iam.gserviceaccount.com" 2>/dev/null \
|| gcloud iam service-accounts create "${SA_NAME}" \
  --display-name="GitHub Actions Deploy" \
  --quiet

SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"

# ── IAM Roles ───────────────────────────────────────────────
echo "▸ Binding IAM roles..."
ROLES=(
  "roles/run.admin"
  "roles/artifactregistry.writer"
  "roles/secretmanager.secretAccessor"
  "roles/storage.objectAdmin"
  "roles/iam.serviceAccountUser"
)
for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "${PROJECT}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="${ROLE}" \
    --condition=None \
    --quiet 2>/dev/null
done

# ── Workload Identity Federation ────────────────────────────
echo "▸ Setting up Workload Identity Federation..."
gcloud iam workload-identity-pools describe "${WIF_POOL}" \
  --location=global --format="value(name)" 2>/dev/null \
|| gcloud iam workload-identity-pools create "${WIF_POOL}" \
  --location=global \
  --display-name="GitHub Actions Pool" \
  --quiet

gcloud iam workload-identity-pools providers describe "${WIF_PROVIDER}" \
  --workload-identity-pool="${WIF_POOL}" \
  --location=global --format="value(name)" 2>/dev/null \
|| gcloud iam workload-identity-pools providers create-oidc "${WIF_PROVIDER}" \
  --workload-identity-pool="${WIF_POOL}" \
  --location=global \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_ORG}/${GITHUB_REPO}'" \
  --quiet

gcloud iam service-accounts add-iam-policy-binding "${SA_EMAIL}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe ${PROJECT} --format='value(projectNumber)')/locations/global/workloadIdentityPools/${WIF_POOL}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}" \
  --quiet 2>/dev/null

# ── Secret Manager secrets ──────────────────────────────────
echo "▸ Creating secrets (if needed)..."
SECRETS=("mongo-uri" "jwt-secret" "webauthn-rp-id" "webauthn-origin" "cors-origins")
for SECRET in "${SECRETS[@]}"; do
  gcloud secrets describe "${SECRET}" --format="value(name)" 2>/dev/null \
  || gcloud secrets create "${SECRET}" --replication-policy=automatic --quiet
done

# ── GCS backup bucket ──────────────────────────────────────
echo "▸ Creating backup bucket (if needed)..."
gcloud storage buckets describe "${GCS_BUCKET}" 2>/dev/null \
|| gcloud storage buckets create "${GCS_BUCKET}" \
  --location="${REGION}" \
  --uniform-bucket-level-access \
  --quiet

# Set lifecycle: delete backups older than 90 days
cat > /tmp/lifecycle.json <<'LIFECYCLE'
{
  "rule": [{
    "action": {"type": "Delete"},
    "condition": {"age": 90}
  }]
}
LIFECYCLE
gcloud storage buckets update "${GCS_BUCKET}" --lifecycle-file=/tmp/lifecycle.json --quiet
rm /tmp/lifecycle.json

echo ""
echo "✔ GCP bootstrap complete for project ${PROJECT}."
echo ""
echo "Next steps:"
echo "  1. Set secret values:  gcloud secrets versions add mongo-uri --data-file=-"
echo "  2. Set secret values:  gcloud secrets versions add jwt-secret --data-file=-"
echo "  3. Set secret values:  gcloud secrets versions add webauthn-rp-id --data-file=-"
echo "  4. Set secret values:  gcloud secrets versions add webauthn-origin --data-file=-"
echo "  5. Set secret values:  gcloud secrets versions add cors-origins --data-file=-"
echo "  6. Add FIREBASE_SERVICE_ACCOUNT secret to GitHub repo settings"

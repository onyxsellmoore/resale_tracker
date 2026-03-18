#!/usr/bin/env bash
# Creates a fresh org + admin user with a unique email and org name.
# Safe to run repeatedly — each invocation creates an independent user.
# Requires: curl, running backend on :8080

set -euo pipefail

API="${BOOKING_API_URL:-http://localhost:8080}/api/v1"

# Verify the backend is reachable
if ! curl -sf "${API%/api/v1}/q/health" -o /dev/null 2>/dev/null; then
  echo "ERROR: Backend is not reachable at ${API%/api/v1}" >&2
  echo "Start it first:  cd booking-api && ./mvnw quarkus:dev" >&2
  exit 1
fi

TIMESTAMP=$(date +%s)
SLUG="dev-${TIMESTAMP}"
EMAIL="dev-${TIMESTAMP}@example.com"

echo "Creating org + admin user..."
echo "  Org name: ${SLUG}"
echo "  Email:    ${EMAIL}"
echo ""

HTTP_CODE=$(curl -s -o /tmp/seed-response.json -w '%{http_code}' \
  -X POST "${API}/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"orgName\":\"${SLUG}\",\"orgSlug\":\"${SLUG}\",\"adminEmail\":\"${EMAIL}\",\"adminDisplayName\":\"Dev Admin\"}")

if [ "$HTTP_CODE" != "201" ]; then
  echo "ERROR: Expected 201 but got ${HTTP_CODE}" >&2
  cat /tmp/seed-response.json >&2
  echo "" >&2
  exit 1
fi

echo "User created successfully."
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:5173/setup"
echo "  2. Enter organization name: ${SLUG}"
echo "  3. Enter email: ${EMAIL}"
echo "  4. Pick any display name and click Create Organization"
echo "  5. Confirm the passkey prompt (Touch ID / Face ID / Windows Hello)"

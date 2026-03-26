# CI/CD Fix Prompt

> Send this file to Claude Code from the repo root.

---

You are editing `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.
Make **only** the changes described below. Do not modify any other files and do not write any tests — these are CI/CD config files.

---

## Change 1 — OWASP job must fail when the scan fails

In **both** files, the OWASP Dependency Check step has `continue-on-error: true`.
Remove that line from the OWASP step in both files. No other steps are affected.

---

## Change 2 — Fix OWASP NVD API key passing

In **both** files the secret is currently interpolated inline in the shell command, which can silently corrupt the value. Replace the OWASP Dependency Check step in both files as shown (apply Changes 1 and 2 together on this step):

**`ci.yml` — replace the entire OWASP step:**

```yaml
      - name: OWASP Dependency Check (backend)
        working-directory: booking-api
        env:
          NVD_API_KEY: ${{ secrets.NVD_API_KEY }}
        run: ./mvnw -B org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=7 -DsuppressionFiles=../.github/owasp-suppressions.xml "-DnvdApiKey=${NVD_API_KEY}"
```

**`deploy.yml` — replace the entire OWASP step:**

```yaml
      - name: OWASP Dependency Check
        working-directory: booking-api
        env:
          NVD_API_KEY: ${{ secrets.NVD_API_KEY }}
        run: ./mvnw -B org.owasp:dependency-check-maven:check -DfailBuildOnCVSS=7 -DsuppressionFiles=../.github/owasp-suppressions.xml "-DnvdApiKey=${NVD_API_KEY}"
```

Key changes: `continue-on-error: true` removed; secret moved to `env:` block; Maven property now references the env var as `"${NVD_API_KEY}"` so it is passed as a single quoted token regardless of key content.

---

## Change 3 — Upgrade Node.js to current Active LTS (24)

In **both** files, change every `node-version: 20` to `node-version: 24`.

Exact locations:

| File | Job | Step |
|------|-----|------|
| `ci.yml` | `test-frontend` | `actions/setup-node@v4` |
| `ci.yml` | `security-scan` | `actions/setup-node@v4` |
| `deploy.yml` | `test-frontend` | `actions/setup-node@v4` |
| `deploy.yml` | `security-scan` | `actions/setup-node@v4` |
| `deploy.yml` | `deploy-frontend` | `actions/setup-node@v4` |

---

## Change 4 — Cloud Run: always pull latest secret versions

In `deploy.yml`, in the **Deploy to Cloud Run** step, change the flag from `--set-secrets` to `--update-secrets`. Leave every secret binding exactly as-is (all already use the `:latest` alias). `--update-secrets` ensures Cloud Run always resolves the current latest secret version on each deployment and does not silently clear any secret bindings added outside this workflow.

```
--set-secrets=QUARKUS_MONGODB_CONNECTION_STRING=mongo-uri:latest,...
```
→
```
--update-secrets=QUARKUS_MONGODB_CONNECTION_STRING=mongo-uri:latest,...
```

Only the flag name changes; the key=secret:version pairs are unchanged.

---

## Verification

After making all changes, confirm:

1. `ci.yml` OWASP step has no `continue-on-error` line, has `env: NVD_API_KEY:`, and uses `"-DnvdApiKey=${NVD_API_KEY}"`.
2. `deploy.yml` OWASP step has the same structure as above (with name `OWASP Dependency Check`, not `OWASP Dependency Check (backend)`).
3. `grep -n "node-version" .github/workflows/ci.yml .github/workflows/deploy.yml` shows only `24`, never `20`.
4. `deploy.yml` Deploy to Cloud Run step uses `--update-secrets`, not `--set-secrets`.
5. No other files were modified.

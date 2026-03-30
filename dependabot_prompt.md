# Dependabot — Booking Platform

## Read these files before acting
```
.github/workflows/ci.yml       — confirms PR trigger + existing job permissions
CONTEXT.md                     — stack versions and directory layout
```

## Context
- Backend: Maven, `booking-api/` · Frontend: npm, `booking-ui/`
- GitHub Actions workflows: `.github/workflows/`
- CI already triggers on `pull_request → main`; Dependabot PRs will hit it automatically
- No `.github/dependabot.yml` exists yet

---

## TASK 1 — `.github/dependabot.yml`

Three ecosystems. All scheduled weekly on Monday 09:00 UTC.
Use `open-pull-requests-limit: 5` for maven and github-actions, `10` for npm.
Add label `dependencies` to all; add `java` to maven updates, `javascript` to npm updates.

**maven** — directory `/booking-api`
- Group all `io.quarkus` artifact updates into one PR: `quarkus-framework`
- Group all other dependency updates into one PR: `maven-dependencies`
- Ignore `major` version bumps for `io.quarkus:quarkus-bom` (Quarkus major upgrades are
  intentional and need manual review)

**npm** — directory `/booking-ui`
- Group all `devDependencies` into one PR: `npm-dev-dependencies`
  (match: `dependency-type: development`)
- Group all `dependencies` (production) into one PR: `npm-prod-dependencies`
  (match: `dependency-type: production`)
- Ignore `major` version bumps for `react` and `react-dom` (major React upgrades need
  manual migration)

**github-actions** — directory `/`
- Group all action version updates into one PR: `github-actions`

---

## TASK 2 — `.github/workflows/dependabot-automerge.yml`

Read `.github/workflows/ci.yml` first to understand existing permissions and job names.

Auto-merge Dependabot PRs **only for patch-level updates** after the CI gate passes.

```
trigger: pull_request targeting main
condition: github.actor == 'dependabot[bot]'

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    steps:
      - uses: dependabot/fetch-metadata@v2
        id: meta
      - name: Auto-merge patch updates
        if: steps.meta.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{ github.event.pull_request.html_url }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Do not auto-merge minor or major updates — those require human review.
Do not auto-merge if the PR touches more than one ecosystem (Dependabot grouped PRs
covering a major bump alongside patches should be reviewed manually).

---

## TASK 3 — Verification

After creating both files:

1. Validate YAML: `actionlint .github/workflows/dependabot-automerge.yml`
2. Validate dependabot config schema:
   `docker run --rm -v $(pwd):/repo ghcr.io/dprint/dprint:latest check /repo/.github/dependabot.yml 2>/dev/null || npx yaml-lint .github/dependabot.yml`
   If neither tool is available: manually confirm the file has `version: 2` at the top and
   each `package-ecosystem` block contains exactly `directory`, `schedule`, and `groups` keys.
3. Confirm the `ci.yml` `pull_request` trigger has no `paths:` filter that would exclude
   Dependabot PRs (it currently does not — verify this has not changed).

---

## TASK 4 — `CONTEXT.md` update

Read `CONTEXT.md` Section 12 (CI/CD Pipeline table), then append to it:

Add a row to the existing workflow table:
`dependabot-automerge.yml | Dependabot PR (patch only) | auto-merge after CI gate passes`

Add one line to the "Security scanning" note:
"Dependabot: weekly PRs for Maven, npm, and GitHub Actions dependencies; patch updates
auto-merge after CI gate; minor/major require manual review."

---

## Execution constraints

- **No changes to `ci.yml`** — it already handles Dependabot PRs via the existing
  `pull_request` trigger. Do not add a `pull_request_target` trigger.
- **`GITHUB_TOKEN` only** — the auto-merge workflow uses `secrets.GITHUB_TOKEN` (built-in).
  No additional secrets needed.
- **Patch only for auto-merge** — `semver-minor` and `semver-major` must never be
  auto-merged, regardless of ecosystem.
- **Valid YAML** — both files must pass `actionlint` with zero errors before finishing.

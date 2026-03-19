# Inventory Ledger

Inventory and sales tracking platform for small businesses. Built with Quarkus 3 (Java 21) + React 19 + MongoDB.

## Prerequisites

- Java 21 (via SDKMAN: `sdk use java 21.0.9-jbr`)
- Node 20+
- Docker Desktop

## Run locally

1. Start infrastructure (MongoDB on 27017, Mongo Express on 8081, MailHog on 8025):

   ```bash
   docker compose up -d mongodb mongo-express mailhog
   ```

2. Start the backend (http://localhost:8080). Live reload is active — changes take effect immediately:

   ```bash
   cd booking-api && ./mvnw quarkus:dev
   ```

3. Start the frontend (http://localhost:5173):

   ```bash
   cd booking-ui && npm install && npm run dev
   ```

## Run tests

Backend:

```bash
cd booking-api && ./mvnw test
```

Frontend:

```bash
cd booking-ui && npm test -- --run
```

## Testing the import feature

The full stack must be running — see [Run locally](#run-locally) above. You must be logged in with at least one item in inventory (use **Inventory → Add Item** to add one first).

**Uploading a Mercari export**
1. Navigate to **Sales** and click **Import Sales**.
2. Upload `sample_exports/mercari.csv`. The app validates the file structure before parsing. If the file is invalid, a descriptive error message is shown and no rows are loaded.
3. Completed rows are shown in the match table. Rows with an `Order Status` other than `Completed` are automatically excluded during parsing.
4. For each row, type part of an item name in the search box to find a matching inventory item, or click **＋ Create new item** and fill in purchase date and condition (Mercari exports do not include cost, brand, or category data).

**Uploading a Poshmark export**
1. Upload `sample_exports/posh-report.csv`. The parser skips the multi-line metadata block at the top of the file automatically.
2. Brand, category, and cost price (when present in the `Cost Price` column) are pre-filled in the new-item form — you only need to provide purchase date and condition.

**Overlapping exports**
If you upload an export that contains rows already imported in a previous session, those rows are shown with an "Already imported" badge and are automatically excluded from the import. You do not need to manually skip them.

**Completing the import**
After matching or creating items for all unresolved rows, proceed to Step 3. Review the summary, then click **Confirm Import**. Imported sales will appear on the Sales page with correct platform fees and computed profit.

**Recording a sale manually**
The item picker on the **Record a Sale** form uses the same search-as-you-type input as the import flow. Type any part of an item name or brand to find it — no scrolling through a dropdown required.

## Set up a test user and try the UI

The full stack must be running first — see [Run locally](#run-locally) above.

### 1 — Create a test user

```bash
./scripts/seed-dev-user.sh
```

Example output:

```
Creating org + admin user...
  Org name: dev-1742184000
  Email:    dev-1742184000@example.com

User created successfully.

Next steps:
  1. Open http://localhost:5173/setup
  2. Enter organization name: dev-1742184000
  3. Enter email: dev-1742184000@example.com
  4. Pick any display name and click Create Organization
  5. Confirm the passkey prompt (Touch ID / Face ID / Windows Hello)
```

Each run creates a fresh unique user. Previous users are not affected and can still log in.

### 2 — Register your passkey

Open http://localhost:5173/setup. Enter the organization name and email printed by the script. Fill in any display name you like. Click **Create Organization**. The browser prompts to create a passkey — confirm with Touch ID, Face ID, or Windows Hello. You land on the Analytics page.

> **Troubleshooting:** Passkeys are stored on your device. If you switch to a different browser or machine you need to run the script again and go through setup once more on that device. Use a standard browser window, not incognito. Chrome, Edge, or Safari are recommended — Firefox on Linux has limited passkey support.

### 3 — Explore the app

| Page | URL | What to try |
|------|-----|-------------|
| Analytics | /analytics | Default landing page after login |
| Inventory | /inventory | Add an item with a purchase price |
| Sales | /sales | Record a sale against that item |
| Users | /users | Invite a team member with a different role |

### 4 — Sign out and sign back in

Sign out from the nav bar. Go to http://localhost:5173/login. Enter the email the script printed. Click **Sign in with passkey**. Confirm with your device authenticator. You land on Analytics.

### 5 — Run the walkthrough again

If you want a fresh isolated session, run `./scripts/seed-dev-user.sh` again. It creates a new independent user. All previous users and their data remain intact.

## Environment variables

Copy `.env.example` to `.env` and fill in values before deploying.
Local dev works without `.env` — defaults are set in `application.properties`.

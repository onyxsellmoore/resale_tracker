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

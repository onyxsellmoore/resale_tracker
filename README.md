# Inventory Ledger

Inventory and sales tracking platform for small businesses. Built with Quarkus 3 (Java 25) + React 19 + MongoDB.

## Prerequisites

- Java 25
- Node 20+
- Docker Desktop
- Xcode 15+ (for the iOS app — optional if you only need web)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)

## Run locally

1. Start infrastructure (MongoDB on 27017, Mongo Express on 8081):

   ```bash
   docker compose up -d mongodb mongo-express
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

iOS:

```bash
cd booking-ios
xcodegen generate                        # creates Booking.xcodeproj from project.yml
xcodebuild test -scheme Booking \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

> **Note:** If `xcodebuild` fails with "unable to find utility", your active developer directory may point to CommandLineTools instead of Xcode. Fix with `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`, or prefix commands with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`.

## Run the iOS app on Simulator

The backend must be running first — see [Run locally](#run-locally) steps 1 and 2. Verify the backend is up:

```bash
curl -s http://localhost:8080/api/v1/auth/register | head -c 100
# Should return a JSON error (not "connection refused")
```

### 1 — Generate the Xcode project and open it

The `.xcodeproj` is generated from `booking-ios/project.yml` and is not checked into git.

```bash
cd booking-ios
xcodegen generate
open Booking.xcodeproj
```

### 2 — Build and run

In Xcode, select an iPhone simulator from the device dropdown (e.g. "iPhone 17 Pro"), then press **Cmd+R**. The app launches on the simulator showing the login screen.

<details>
<summary>Command-line alternative (no Xcode GUI)</summary>

```bash
xcodebuild build -scheme Booking \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro'

xcrun simctl boot 'iPhone 17 Pro'
xcrun simctl install booted \
  ~/Library/Developer/Xcode/DerivedData/Booking-*/Build/Products/Debug-iphonesimulator/Booking.app
xcrun simctl launch booted com.tav.booking
```
</details>

### 3 — Enroll Face ID (one-time setup)

Before you can register or sign in with a passkey, the simulator needs Face ID enabled:

1. In the Simulator menu bar: **Features → Face ID → Enrolled**

You only need to do this once per simulator instance.

### 4 — Create an organization and register

1. Tap **Create a new organization**
2. Fill in Organization Name, Your Name, and Email, then tap **Create Organization**
3. A Face ID prompt appears — in the Simulator menu bar, quickly click **Features → Face ID → Matching Face** (the prompt times out after a few seconds)
4. On success you land on the Inventory tab, already logged in

### 5 — Sign in again later

1. On the login screen, enter the same email you registered with
2. Tap **Sign in with Passkey**
3. Approve Face ID (**Features → Face ID → Matching Face**)
4. You land on the Inventory tab

The app connects to `http://localhost:8080` (configured in `Info.plist` → `API_BASE_URL`). If you see a network error, make sure the backend is running.

## Install on a personal device

Any free Apple ID works — a paid Developer Program membership ($99/year) is only required for App Store distribution.

### 1 — Configure signing

1. Open `booking-ios/Booking.xcodeproj` in Xcode
2. Select the **Booking** target → **Signing & Capabilities**
3. Change **Team** to your Apple ID (sign in via Xcode → Settings → Accounts if not already added)
4. Xcode auto-generates a free provisioning profile for the device. You may need to change the bundle ID to something unique (e.g. `com.yourname.booking`) since free profiles require a unique identifier

### 2 — Set up Associated Domains

Passkeys on a real device require the `rpId` to match a domain you control, verified via an `apple-app-site-association` file.

1. In Xcode → **Signing & Capabilities → + Capability → Associated Domains**
2. Add `webcredentials:yourdomain.com`
3. Host the following at `https://yourdomain.com/.well-known/apple-app-site-association`:

   ```json
   {
     "webcredentials": {
       "apps": ["<TEAM_ID>.com.tav.booking"]
     }
   }
   ```

   Replace `<TEAM_ID>` with your 10-character Apple team identifier (visible in the Developer portal).

4. Update backend config to match:

   ```properties
   booking.webauthn.rp-id=yourdomain.com
   booking.webauthn.origin=https://yourdomain.com
   booking.webauthn.allowed-origins=https://yourdomain.com
   ```

### 3 — Update the API base URL

Edit `booking-ios/Booking/Info.plist` and change `API_BASE_URL` from `http://localhost:8080` to your deployed backend URL (e.g. `https://booking-api-xxxxx.run.app`).

Or, for local testing over Wi-Fi, use your Mac's local IP:

```bash
# Find your Mac's IP
ipconfig getifaddr en0    # e.g. 192.168.1.42
```

Then set `API_BASE_URL` to `http://192.168.1.42:8080` and ensure the `NSAppTransportSecurity` exception in Info.plist covers that host.

### 4 — Build and run

1. Connect your iPhone via USB (or use wireless debugging if paired)
2. Select your device from the Xcode device dropdown
3. Press **Cmd+R**
4. On first install, go to **Settings → General → VPN & Device Management** on the phone and trust your developer certificate

### Passkey sync across devices

Passkeys created on one Apple device sync automatically via iCloud Keychain to all devices signed into the same Apple ID (with Keychain enabled in iCloud settings). This means a passkey registered on Simulator won't appear on a real device — register a new passkey on each device, or use real devices that share an iCloud account.

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

## Production architecture

```
[User's browser]
      │  HTTPS
      ▼
[Firebase Hosting CDN]  ──HTTPS──►  [Cloud Run — us-central1]
                                              │
                                       MongoDB wire protocol (TLS)
                                              │
                                              ▼
                                    [Atlas M0 — GCP us-central1]
```

**Prerequisites for deployment:** GCP CLI (`gcloud`), Firebase CLI (`firebase`), Docker

### Deploy frontend

```bash
cd booking-ui
cp .env.production.example .env.production   # set VITE_API_URL to Cloud Run URL
npm run build
firebase deploy --only hosting
```

### Deploy backend

Production deploys happen automatically via GitHub Actions on push to `main`. For manual deploys:

```bash
cd booking-api && ./mvnw package -DskipTests
IMAGE=us-central1-docker.pkg.dev/resale-tracker-pr/booking/booking-api:latest
docker buildx build --platform linux/amd64 -f src/main/docker/Dockerfile.jvm -t $IMAGE .
docker push $IMAGE
gcloud run deploy booking-api --image $IMAGE --region us-central1 --project resale-tracker-pr
```

## CI/CD

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `.github/workflows/ci.yml` | PR → main | Tests + security scan (gate) |
| `.github/workflows/deploy.yml` | Push → main | Tests + deploy backend (Cloud Run) + frontend (Firebase) |
| `.github/workflows/backup.yml` | Weekly / manual | Atlas mongodump → GCS |

First-time GCP setup: `./scripts/gcp-setup.sh` (idempotent).

## Required environment files (gitignored)

These files are not committed — recreate locally:

- `booking-ui/.env.production` — set `VITE_API_URL` to the Cloud Run service URL
- `booking-ui/.env.development` — set `VITE_API_URL=http://localhost:8080` (optional; Vite proxy handles this)

# VeinReach 🩸

Blood Donation & Emergency Blood Request Platform — connecting donors, recipients, hospitals, and blood banks through location-based matching, real-time notifications, and intelligent donor discovery.

> Full product spec lives in [CLAUDE.md](./CLAUDE.md).

## Monorepo Layout

```
ByBlood/
├── backend/            Node.js + Express + Socket.io + MongoDB API (REST /api/v1)
├── frontend/           React + Vite + Tailwind + TanStack Query SPA
├── CLAUDE.md           Product specification
├── SESSION_SUMMARY.md  Notes from the latest work session
└── README.md           You are here
```

Local dev ports: **API on 5000**, **SPA on 3000**.

## Quick Start

### Run everything with Docker (recommended)

Brings up MongoDB, Redis, the API, and the frontend with one command — no local
Node or MongoDB install needed.

```bash
cp .env.example .env       # optional: set real JWT secrets
docker compose up --build
```

- Frontend: http://localhost:8080 (nginx proxies `/api` + `/socket.io` to the API)
- API:      http://localhost:5000/api/v1/health
- MongoDB:  localhost:27017 · Redis: localhost:6379

`docker compose down` stops the stack; add `-v` to also wipe the data volumes.

### Run locally without Docker

#### Prerequisites
- Node.js >= 18 (tested on 22)
- MongoDB (Atlas or local) — required
- Redis — optional in dev (queues/presence degrade gracefully if absent)

### 1. Backend

```bash
cd backend
cp .env.example .env      # then fill in real values
npm install
npm run dev               # starts API on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev               # starts SPA on http://localhost:3000
```

### 3. Create the first admin

`admin` cannot be chosen at registration, and granting it normally requires an
existing admin — so a fresh database has none. Until you create one, **no
hospital or blood bank can be onboarded**, because organisation verification is
admin-only.

The bootstrap is **promote-only**: it elevates an account that already
registered through the app, and never creates one from configuration. That
keeps admin passwords out of your environment and logs.

```bash
# 1. Register the address normally in the UI (http://localhost:3000/register)

# 2a. Either set it in backend/.env and restart:
ADMIN_EMAILS=you@example.com

# 2b. …or run the one-off command:
cd backend && npm run admin:grant -- you@example.com
```

Idempotent and non-destructive: safe on every boot, never demotes (so removing
the variable cannot lock you out), and it refuses suspended accounts.

## What's implemented in this foundation

**Backend**
- Layered architecture: `routes → controllers → services → repositories → models`
- JWT access + refresh token auth, bcrypt hashing
- User/Donor model with GeoJSON location + `2dsphere` index
- Blood compatibility engine + donor eligibility validation (age, weight, cooldown, availability)
- Blood request CRUD + geospatial nearby-donor search, sorted by compatibility → distance → reputation
- Centralized error handling, standard response envelope `{ success, data, message }`
- Security: helmet, CORS, rate limiting, Zod input validation, **CSRF
  protection** (double-submit token), and **audit logging** of security events
- Socket.io server wired for real-time donor radar / request events
- Redis wrapper (optional, no-ops if unconfigured)
- Cloudflare R2 storage: presigned uploads for profile images + verification/
  hospital documents + chat attachments; server-generated donation certificates
- Donation certificates (SVG) auto-issued on verified donation, stored in R2
- In-app chat: 1:1 conversations, message persistence, delivery + read receipts,
  typing indicators, file attachments, and a contact-reveal gate (phone/email
  hidden until the request is accepted or both parties consent)
- Mobile OTP verification (hashed codes, TTL, attempt cap, resend cooldown;
  SMS via Twilio, logged in dev)
- Donation history + certificate + feedback REST endpoints
- **Admin dashboard API**: user directory (filter/suspend/role), organization
  verification (review uploaded docs → approve/reject), platform analytics,
  report review + moderation actions
- **Reports & abuse moderation**: users report a user/request; admins resolve
  with warn / suspend / reputation-penalty actions
- **Blood bank portal**: geo-discoverable inventory, publish availability +
  shortages, emergency shortage alerts to nearby compatible donors
- **Hospital portal**: verified-donation ledger, hospital-scoped analytics,
  nearby-donor search (create requests + verify donations already supported)
- **Analytics dashboard**: platform KPIs + time-series trends (donor growth,
  donations, requests) and an admin **audit trail** viewer

**Frontend**
- Vite + React + React Router + Tailwind
- TanStack Query + Axios API client with auth token refresh
- Auth context, login/register pages, protected routes
- App shell with layout, navigation, and a dashboard stub

## Frontend coverage

The SPA now covers the full stack above: auth, dashboard, requests, donor
radar/map, **profile** (avatar upload, mobile OTP, documents), **in-app chat**
(receipts, typing, contact reveal, attachments), **donation history**
(certificates + feedback), **reputation & badges**, a **notifications** page,
public **blood-bank discovery**, and role-gated **admin / blood-bank /
hospital** portals.

**Accessibility:** skip link, visible keyboard-focus styles, ARIA labels on
icon controls, Escape/click-outside dismissal for popovers, and a persistent
**high-contrast mode** (honouring `prefers-contrast`) — covering the spec's
keyboard-navigation, screen-reader, and high-contrast requirements.

## Roadmap (not yet built)

The backend feature set now covers the full spec (P1–P3). Remaining work is
largely the mobile apps and the "Future Enhancements" in
[CLAUDE.md](./CLAUDE.md) — AI donor recommendations, multi-language, WhatsApp
notifications, predictive shortage analytics, and disaster-response mode.

## Credentials needed (later)

All optional services use placeholders in `.env.example` so development is unblocked.
Fill these in when ready: MongoDB URI, JWT secrets, Redis URL, Cloudflare R2 keys,
Firebase FCM service account, SMTP (Nodemailer) credentials.

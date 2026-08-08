# Deploying VeinReach

Target setup, all free tier:

| Piece | Host | Notes |
| --- | --- | --- |
| API (Express + Socket.io) | Render, Docker web service | Free plan sleeps when idle |
| Frontend (Vite SPA) | Cloudflare Pages | Static, global CDN |
| Database | MongoDB Atlas M0 | 512 MB |
| Redis | *(skipped)* | Optional — see step 6 |
| Uploads | Cloudflare R2 | Optional — see step 6 |

The order below matters. The frontend needs the API's URL at **build** time, and
the API needs the frontend's URL for CORS — so the first pass deploys the API
with a placeholder, then comes back to fix it in step 5.

---

## 1. MongoDB Atlas

1. Create a free **M0** cluster at <https://cloud.mongodb.com>.
2. **Database Access** → add a user with *Read and write to any database*. Use a
   generated password and copy it.
3. **Network Access** → Add IP → **Allow access from anywhere** (`0.0.0.0/0`).

   This is required, not laziness: Render's free plan has no static outbound IP,
   so there is nothing to allowlist. Your database is still protected by the
   user password and TLS.
4. **Connect → Drivers** and copy the SRV string. Replace `<password>` and add
   the database name:

   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/veinreach?retryWrites=true&w=majority
   ```

## 2. Deploy the API to Render

1. <https://dashboard.render.com> → **New → Blueprint** → connect
   `IzhaarAhmed/VeinReach`. Render reads [`render.yaml`](./render.yaml) and
   proposes the `veinreach-api` service.
2. It will prompt for every `sync: false` variable. For this first pass fill in
   only:
   - `MONGODB_URI` — from step 1
   - `ADMIN_EMAILS` — your email; the first account registered with it becomes admin
   - `CLIENT_URL` — `https://veinreach.pages.dev` (a guess for now; corrected in step 5)

   Leave the optional ones blank. `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
   are generated automatically — do not paste the `dev_*_change_me` placeholders.
3. Apply, and wait for the build. Note the assigned URL, e.g.
   `https://veinreach-api.onrender.com`.
4. Verify:

   ```bash
   curl https://veinreach-api.onrender.com/api/v1/health
   ```

   First call after idle takes ~50s while the container wakes. That is expected
   on the free plan.

## 3. Deploy the frontend to Cloudflare Pages

<https://dash.cloudflare.com> → **Workers & Pages → Create → Pages → Connect to
Git** → pick the repo, then:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `frontend` |

Add these **environment variables** (Settings → Environment variables), using
your real Render URL:

```
VITE_API_URL=https://veinreach-api.onrender.com/api/v1
VITE_SOCKET_URL=https://veinreach-api.onrender.com
```

> Vite inlines `VITE_*` values into the bundle at build time. They are **not**
> read at runtime, so changing one later requires a redeploy, and none of them
> may hold a secret — assume anything prefixed `VITE_` is public.

Both are **required**, and the build enforces it. `frontend/vite.config.js`
refuses to produce a production bundle when either is missing, points at
localhost, or isn't a valid `http(s)` URL. It also warns if the two are swapped —
`VITE_API_URL` ends in `/api/v1`, `VITE_SOCKET_URL` is the bare origin.

Without that guard a forgotten variable is genuinely nasty to diagnose: the
bundle falls back to `http://localhost:5000` (`src/lib/api.js:3`,
`src/lib/socket.js:4`), so the site deploys, loads and looks fine, and then every
request fails — blocked as mixed content on an HTTPS page before it is even sent,
which leaves nothing useful in the network tab.

To build with no real API behind it (CI, or a local production smoke test):

```bash
VEINREACH_ALLOW_LOCAL_BUILD=1 npm run build
```

If you want web push, also copy the seven `VITE_FIREBASE_*` values from your
local `frontend/.env`. Skip them and push is silently disabled; nothing else
breaks.

Deploy, and note the URL, e.g. `https://veinreach.pages.dev`.

## 4. SPA deep links

Already handled: [`frontend/public/_redirects`](./frontend/public/_redirects)
rewrites `/*` to `/index.html` with a 200. Without it, refreshing on any route
other than `/` returns a 404, because only `index.html` exists on disk.

## 5. Point the API back at the real frontend URL

In Render → `veinreach-api` → **Environment**, set `CLIENT_URL` to the exact
Pages origin from step 3 and save (this redeploys):

```
CLIENT_URL=https://veinreach.pages.dev
```

Three rules, all enforced by an exact string comparison in
`backend/src/config/env.js:150`:

- **No trailing slash.** The browser's `Origin` header never has one.
- **Scheme + host only**, no path.
- **Comma-separate** for multiple origins — add Cloudflare's per-branch preview
  domain here if you want previews to reach the API.

Get this wrong and every API call fails CORS. In production the dev-only
loopback exemption is off, so the match must be exact.

## 6. Optional integrations

Add these whenever you want; each is independently skippable.

- **Redis** — <https://upstash.com> free tier, paste the `redis://` URL into
  `REDIS_URL`. Until then `config/redis.js` uses a no-op stub, so rate limits
  and presence counts are per-instance rather than shared. Harmless on one dyno.
- **R2 uploads** — set the five `R2_*` vars. `R2_PUBLIC_URL` is the bucket's
  public development URL or your custom domain.
- **Email** — set the `SMTP_*` vars and `MAIL_FROM`.
- **Web push** — paste the Firebase Admin service account JSON as one line into
  `FCM_SERVICE_ACCOUNT`, and add `veinreach.pages.dev` under Firebase Console →
  Authentication → Settings → **Authorized domains**.

---

## The free-tier tradeoff

Render's free plan stops the container after ~15 minutes without a request.
While it is asleep:

- the escalation worker (`WORKER_INTERVAL_SEC=60`) does **not** run, so
  unfulfilled blood requests are not escalated on schedule;
- open WebSocket connections are dropped;
- the next request pays a ~50 second cold start.

For a portfolio demo this is fine. Before real users depend on it, change
`plan: free` to `plan: starter` in `render.yaml` ($7/mo) — that is the only edit
required.

A keep-alive ping (cron-job.org hitting `/api/v1/health` every 10 minutes) works
around the sleeping, and one always-on service fits inside the free 750
instance-hours/month. It does not fix the cold start already in progress, and it
means the worker runs continuously, which is the actual thing you want.

## Cookies, in case auth misbehaves

The SPA and API are on different registrable domains (`pages.dev` vs
`onrender.com`), so the refresh and CSRF cookies are cross-site. They are
already correct — `backend/src/controllers/auth.controller.js:12` sets
`sameSite: 'none'` and `secure: true` whenever `COOKIE_SECURE=true`, which
`render.yaml` pins. Both hosts are HTTPS, which `SameSite=None` requires.

If login succeeds and then instantly logs out, the cause is almost always
`COOKIE_SECURE` being unset or `CLIENT_URL` not exactly matching the Pages
origin.

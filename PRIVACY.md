# Privacy

The privacy policy is **published in the app** at `/privacy`, and its text lives in
one place:

    frontend/src/content/privacyPolicy.js

That module is the single source of truth. This file deliberately does not
restate the policy — two copies of a legal document drift, and the one users
actually read is the page.

## Changing the policy

1. Edit `frontend/src/content/privacyPolicy.js`.
2. If the change is material, bump `version` (and `updated`).
3. Bump `PRIVACY_POLICY_VERSION` in `backend/src/constants/index.js` to match.

Step 3 is not optional: every account stores the policy version it accepted at
registration, so a mismatch means consent records point at text nobody was shown.
`backend/tests/privacy.test.js` fails if the two drift.

## What backs the policy up in code

The policy makes concrete promises. These are where they are kept:

| Promise | Implementation |
| --- | --- |
| Exact coordinates are never shown to another user | `backend/src/repositories/donor.repository.js` — the `$project` omits `location.coordinates` |
| Age, weight and gender are never shown | `backend/src/services/donor.service.js` — fetched for eligibility, then stripped |
| Download everything we hold | `GET /api/v1/users/me/export` → `privacy.service.js#exportAccount` |
| Erase my data | `DELETE /api/v1/users/me` → `privacy.service.js#deleteAccount` |
| Retention windows | `retention.service.js`, run by `workers/retention.worker.js` |
| Consent is recorded, not assumed | `user.consent` on the model; `acceptPrivacy` required by `auth.schema.js` |

## Deployment

Set the grievance contact, or the policy page will say it is unconfigured:

- Backend (Render): `PRIVACY_CONTACT`
- Frontend (Cloudflare Pages): `VITE_PRIVACY_CONTACT`

Retention windows are tunable via `RETENTION_*`; the defaults match the
published text. See `backend/.env.example`.

## Still outstanding

- **Terms of Service.** Not written. Needs decisions this repo cannot make for
  you — liability, governing law, acceptable use.
- **Legal review.** The policy describes the system accurately, but this is
  health data. Have a lawyer read it before real users rely on it.

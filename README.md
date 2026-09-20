# Leadflow rank-and-rent router

Leadflow is a browser-based operational dashboard for routing enquiries from static/headless rank-and-rent websites. The browser client keeps the useful existing prototype, while the project now includes the production data contract, intake boundary, tenant-aware schema, deterministic categorisation, duplicate detection, routing selection, tests, and deployment notes.

## Current status

- The UI starts blank for leads and renters, with the five known assets only. No fake leads, renters, or production credentials are seeded.
- `prisma/schema.prisma` is the PostgreSQL source of truth for workspaces, memberships, businesses, websites, GMB assets, leads, renters, rules, events, notifications, calls, credentials, jobs, and audit logs.
- `server/index.mjs` serves the built browser app and provides the health, website-form, Twilio Voice, Twilio status, Composio webhook, login, and lead-status API boundaries. With `DATABASE_URL` set, website leads, Twilio call leads, call records, lead events, assets, and status changes use Prisma/PostgreSQL. Without it, local development uses a clearly labelled memory fallback.
- `src/domain` contains shared validation and deterministic lead-processing functions with unit tests.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

In another terminal:

```powershell
$env:SOURCE_KEYS_JSON='{"AG-001":"local-demo-key"}'
npm run api
```

For an online deployment, set `AUTH_REQUIRED=true`, `ADMIN_EMAIL`, `SESSION_SECRET`, and an `ADMIN_PASSWORD_HASH` generated with `npm run hash-password`. Do not commit `.env` or paste secrets into chat.

The browser UI is at `http://localhost:5173` and the API health check is at `http://localhost:8787/healthz`. Real email delivery is disabled by default. The inbox remains empty until a real form or call integration is connected.

For a production-like local server, build first and then run `npm start`. It serves `dist/` and the API from one port. Twilio endpoints are `/api/v1/intake/calls/twilio` and `/api/v1/intake/calls/twilio/status`; Composio events use `/api/v1/intake/composio`.

## Database workflow

Use a managed PostgreSQL database for staging and production. Set `DATABASE_URL`, then run:

```powershell
npx prisma migrate deploy
npm run seed
```

The seed creates the master workspace and the five known assets only. It does not create renters, leads, fake contact details, source keys, or OAuth credentials.

## Verification

```powershell
npm test
npm run typecheck
npm run build
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/TWILIO.md](docs/TWILIO.md), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), and [docs/SECURITY.md](docs/SECURITY.md) before connecting a live website or phone system.

For the optional Composio path, read [docs/COMPOSIO.md](docs/COMPOSIO.md). Direct Twilio-to-Leadflow is the recommended first call path.

For the GitHub-to-host deployment sequence, read [docs/GITHUB.md](docs/GITHUB.md).

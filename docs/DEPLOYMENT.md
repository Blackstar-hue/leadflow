# Deployment plan

## Development

Run the Vite client and local API separately. Use a local or disposable PostgreSQL database when exercising Prisma. Keep `NOTIFICATIONS_ENABLED=false`, `EMAIL_PROVIDER=console`, `AUTH_REQUIRED=false`, and `DEMO_MODE=false`; the inbox should remain blank until a real source is connected.

## Staging

Use a managed PostgreSQL database and a separate staging project/domain. Set a staging-only source key for a test asset, enable the fake email provider, run migrations, seed the five known assets, and submit a labelled test form. Verify the lead event timeline, duplicate response, routing failure event, CSV export, and renter permission tests before any production key is created.

## First online staging deployment

The project can now run as one Node web service: it serves the built browser UI and the API from the same HTTPS origin. Render is a suitable first host because its Node web service receives a public `onrender.com` URL, supports environment variables and health checks, and can auto-deploy from a connected Git repository.

### Prepared Render Blueprint

The repository includes `render.yaml`. In Render, choose **New > Blueprint**, select the `Blackstar-hue/leadflow` repository, and review the proposed `leadflow` web service and `leadflow-db` PostgreSQL database before applying it. The blueprint wires the private database URL, runs migrations and the idempotent known-asset seed before each deployment, and generates the session and intake secrets automatically.

Render will ask for the values marked `sync: false`. Enter them only in Render's private setup screen: `ADMIN_EMAIL`, the output of `npm run hash-password`, `SOURCE_KEYS_JSON`, the replacement `TWILIO_AUTH_TOKEN`, `TWILIO_NUMBER_ASSETS_JSON`, and optionally `COMPOSIO_WEBHOOK_SECRET`. Nothing in that list is committed to GitHub. Do not put real secrets in `render.yaml`.

The blueprint uses a paid web-service/database tier suitable for a real always-on service. Confirm the current price in Render before applying it. A free or sleeping service is suitable for a demo, but not for reliable phone lead capture.

Use these values when creating the staging web service:

```text
Build command: npm ci && npm run build
Start command: npm start
Health-check path: /healthz
```

Set `NODE_ENV=staging`, `DEMO_MODE=false`, `AUTH_REQUIRED=true`, `ADMIN_EMAIL`, a generated `ADMIN_PASSWORD_HASH`, `NOTIFICATIONS_ENABLED=false`, `EMAIL_PROVIDER=console`, and a strong generated `SESSION_SECRET`. Add a managed PostgreSQL `DATABASE_URL` before expecting persistence. Set `PUBLIC_APP_URL` to the final HTTPS URL. Do not add live Twilio, renter, Gmail, or website-form secrets to staging until the route is tested.

Generate the password hash locally and copy only the resulting hash into the host's private environment settings:

```powershell
npm run hash-password
```

The first online smoke checks are:

```text
GET  https://YOUR-APP-URL/healthz
GET  https://YOUR-APP-URL/
POST https://YOUR-APP-URL/api/v1/intake/forms/AG-001
POST https://YOUR-APP-URL/api/v1/intake/calls/twilio
POST https://YOUR-APP-URL/api/v1/intake/composio
```

This is a staging deployment only. The current UI is intentionally blank until real integrations deliver data. Confirm the login page appears, the database health/persistence mode is correct, and a test lead survives a service restart before treating the deployment as ready.

## Production

Deploy the app to a managed Node-capable application host such as Render, Railway, Fly.io, or a comparable service with HTTPS, secrets management, background worker support, server-side authentication, and managed PostgreSQL. Hostinger remains the static website host. Configure a custom app domain, HTTPS, `DATABASE_URL`, `SESSION_SECRET`, `INTAKE_KEY_PEPPER`, source-key hashes, email provider secrets, and monitoring. Do not assume Hostinger supports the application runtime/database until it is separately verified.

```powershell
npm ci
npx prisma migrate deploy
npm run build
npm run api
```

Use a process manager or the host's web service for the API and a separate worker for notifications. `/healthz` must check process health and, in production, a bounded database connectivity check.

## Rollback and backups

Deploy immutable builds, retain the previous release, and roll back the application first if a UI/API regression occurs. Never roll back a database by deleting migrations. Use managed PostgreSQL point-in-time recovery plus encrypted daily backups, test restoration regularly, and retain an export snapshot before schema changes.

## Static website connection

Document the exact endpoint, asset key, header name, allowed fields, and a non-production test process before adding a source key to a live static form. The key must be injected by the deployment system or server-side proxy where possible, never committed to frontend code. Connect live websites only after explicit approval.

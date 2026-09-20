# Leadflow architecture and decisions

## Boundary

Static websites remain on Hostinger. They submit to `POST /api/v1/intake/forms/{asset-key}` with an asset-specific source key sent in a request header. The application is a separate TypeScript/React browser client plus a server-side API boundary. The Google Sheet is an export/backup bridge only.

## Data and tenancy

Every business-owned record carries `workspaceId`, and the server must derive the workspace from the authenticated session or the source credential, never from a client-supplied workspace id. Admins can operate across a workspace; renters are restricted to leads assigned to their renter record. All mutations create an audit log and a lead event where applicable.

## Intake transaction

1. Authenticate the source key and enforce rate limits.
2. Parse the simple legacy fields (`name`, `phone`, `message`) plus the structured future fields.
3. Reject a filled honeypot with a generic accepted response.
4. Normalise contact fields and check idempotency/fingerprint duplicates inside a configurable time window.
5. Resolve the asset, categorise deterministically, and select the highest-priority available matching renter.
6. In one PostgreSQL transaction, create the lead and `RECEIVED`/`CATEGORISED`/`ROUTED` or `ROUTING_FAILED` events, then enqueue an idempotent notification job.
7. Return only a generic accepted response; never return credentials or internal errors.

The local `server/index.mjs` uses a clearly labelled in-memory fallback only when `DATABASE_URL` is absent. Production health checks fail without PostgreSQL and configured admin authentication, so a production deployment cannot silently accept leads that would be lost on restart.

## Notifications

Email delivery is behind a provider interface. The default development provider writes to the console and tests use a fake provider. Production delivery must use an outbox/job worker with an idempotency key, bounded retries, redacted logs, and a dead-letter/failure state. Gmail can be connected through a secret-backed provider, but a transactional email provider should be an interchangeable option.

## Calls and Sheets

Call records support manual entry or the signed Twilio provider webhook. The system does not claim to capture GBP calls directly. CSV export is always available; a one-way Google Sheets mirror is optional and must never block lead intake.

## UI decision

The existing Vite/React prototype was retained and extended rather than discarded. It is deliberately a compact operations dashboard: dashboard first, inbox second, technical tracking fields behind lead detail/advanced views, and pending assets visible as setup work.

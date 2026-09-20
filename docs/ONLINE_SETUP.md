# Getting the app online, step by step

## What exists now

The app is a Vite browser client plus one Node server. After `npm run build`, `npm start` serves both the browser UI and the API from one port. This means the eventual Twilio URL and the browser dashboard can share one HTTPS domain.

## What is still needed from an account owner

1. A Git repository or hosting upload location for this project.
2. A managed PostgreSQL database connection string.
3. A hosting account with environment-variable storage and HTTPS.
4. Twilio account details entered privately into the host, not pasted into chat.
5. A decision about the first real renter and notification provider.

## Safe order

1. Deploy a blank staging service.
2. Confirm `/healthz` and the browser dashboard work from a phone or another network.
3. Add the server-side login settings (`AUTH_REQUIRED=true`, `ADMIN_EMAIL`, `SESSION_SECRET`, and a generated `ADMIN_PASSWORD_HASH`) before putting real lead data into the service.
4. Add the PostgreSQL connection and run migrations/seed. The API will then use persistent storage instead of its local memory fallback.
5. Test a signed Twilio call callback using a test number.
6. Add Composio only for the integrations that benefit from its connection and trigger management.
7. Connect one website form with a staging source key.
8. Verify call records, form records, duplicate handling, status changes, routing, and notification test mode.
9. Create a production service and connect live sources only after explicit approval.

The current repository also contains `render.yaml`, which automates the web-service/database wiring described above. It deliberately leaves account secrets as private Render inputs. The deployment is not considered complete until the resulting `/healthz` response reports a healthy PostgreSQL connection and the login flow works from a separate network.

Edits can continue throughout this process. Every change should be built and smoke-tested before deployment; the previous successful deployment remains available for rollback on a managed host.

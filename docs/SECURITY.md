# Security checklist

- Keep `.env`, database URLs, OAuth tokens, webhook URLs, source keys, and SSH keys outside Git. Rotate any secret that is ever exposed.
- Set `AUTH_REQUIRED=true` outside local development, use a long random `SESSION_SECRET`, and generate `ADMIN_PASSWORD_HASH` with `npm run hash-password`; never use the example email/password values as live credentials.
- Hash source keys at rest. The API example accepts secrets only through environment configuration and compares them in constant time.
- Enforce workspace scope in every server query. Never trust `workspaceId`, `assignedRenterId`, or role values from the browser.
- Use secure, HttpOnly, SameSite cookies for sessions, same-origin checks for cookie-authenticated mutations, and security headers in the production host. The current login cookie is HttpOnly/SameSite and production uses Secure.
- Validate with the shared schema, cap request size, rate-limit by source/IP, reject honeypots, and return generic errors.
- Redact raw payloads and personal data from logs. Apply a retention job to raw payloads and support deletion/archival requests.
- Keep notification delivery disabled in tests and use a fake provider. Never use a real renter address in demo mode.
- Run dependency audit, tests, Prisma migration checks, and a production build in CI.

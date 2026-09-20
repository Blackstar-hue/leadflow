# Composio handoff

Composio is optional here. The direct path for calls is Twilio -> Leadflow, because Twilio already sends signed Voice webhooks and Leadflow stores the call record. Composio is useful when an external system needs to trigger an action or when you want to manage several connected services through one integration layer.

## Current endpoint

Send the Composio webhook to:

```text
https://YOUR-LEADFLOW-DOMAIN.example/api/v1/intake/composio
```

Store the Composio signing secret only as `COMPOSIO_WEBHOOK_SECRET` in the Leadflow host. The endpoint accepts a secret in `X-Composio-Signature`, `X-Composio-Webhook-Secret`, or a Bearer token. Include a stable event id as `id`, `event_id`, or `log_id` so retries can be identified.

The current endpoint validates the secret and acknowledges events. With PostgreSQL enabled, provider event ids are stored in the `WebhookEvent` table so retries remain deduplicated after an application restart; local development falls back to process-memory deduplication. It does not invent a lead from an arbitrary Composio payload. A specific event mapping must be agreed first, for example: “new form submission from service X” maps to an existing asset key and then uses the same categorisation and duplicate rules as the website form endpoint.

## Safe order

1. Deploy Leadflow with HTTPS, PostgreSQL, and login enabled.
2. Test the endpoint with a non-production Composio connection and a known event id.
3. Confirm the event appears in server logs without exposing payload secrets.
4. Add one explicit event-to-asset mapping.
5. Re-run the duplicate and retry tests before enabling any notification action.

Do not use Composio as a replacement for Twilio's incoming-call webhook. Twilio's official MCP is a documentation/API-assistance surface, not a public call receiver for this app. See the [Twilio MCP documentation](https://www.twilio.com/docs/ai/mcp) and [Twilio Voice webhook documentation](https://www.twilio.com/docs/usage/webhooks/voice-webhooks).

# Twilio call intake

Yes. If the lead calls arrive through Twilio, Twilio should be connected as a second intake source alongside website forms.

## What the connection will do

Twilio can send an incoming-call webhook and later call-status/recording callbacks to the Leadflow API. The app creates a normal lead in the inbox for the first incoming call, linked to a call record containing the Twilio call ID, received time, Twilio number, caller number, duration, recording URL where available, transcription where available, service category, assignment, status, outcome, and notes. Repeated callbacks update the linked call instead of creating another lead.

The application database remains authoritative. Twilio remains the telephony provider.

## Required production pieces

1. A public HTTPS Leadflow API URL.
2. The Twilio phone number(s) that receive the calls.
3. An incoming voice webhook configured in Twilio to point to the Leadflow call endpoint.
4. A status callback for completed calls and recording callbacks if recordings are enabled.
5. Twilio request-signature verification using the Auth Token, with the token stored only in the deployment secret manager.
6. A decision about whether recordings and transcriptions should be retained, and for how long.

The current call endpoint records the incoming event and returns forwarding TwiML only when `TWILIO_FORWARD_TO` is configured. If it is empty, it returns a safe not-configured response and ends the call. Do not point a live customer number at the endpoint until the forwarding destination and test-call behaviour have been confirmed.

Twilio documents that incoming voice calls are delivered to an HTTP/HTTPS webhook and that requests are cryptographically signed. The production endpoint must use HTTPS and verify `X-Twilio-Signature` before creating or updating a call record. See the [Twilio Voice Webhooks documentation](https://www.twilio.com/docs/usage/webhooks/voice-webhooks) and [Twilio security guidance](https://www.twilio.com/docs/usage/security).

## What I need from you later

Do not paste the Auth Token into chat. When you are ready, provide only the Twilio Account SID, the phone-number mapping, and permission to configure the webhook. The Auth Token should be entered directly into the hosting provider's secret settings.

We should test this in staging first with a test call. It should not route to a renter or send an email until the call flow is verified.

## Current status

The database contains the call-record structure, and the server has signed Twilio webhook boundaries plus a Prisma-backed call-record adapter. The app starts with an empty inbox and will not invent call leads. Persistence becomes active when `DATABASE_URL` is configured and migrations/seed have run.

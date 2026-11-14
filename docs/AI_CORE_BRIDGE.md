# TLCX – AI Core Bridge

Status: implemented as a gateway route and event-publisher adapter; provider deployment and AI execution remain separate release gates.

## Flow

Zapier Catch Hook → authenticated TLCE API Gateway → AI Core Bridge → versioned TLCE event → internal QuestPulse consumer → audit/event logging.

## Ingress contract

- Method: `POST`
- Path: `/integrations/ai-core-bridge`
- Required gateway capability: `integrations.ai-core-bridge.write`
- Required JSON fields: `deliveryId`, `taskId`, and `input` (object)
- Unknown fields are rejected.
- Payload size defaults to 16 KiB.
- Accepted requests publish `questpulse.task.requested`, schema version 1.
- `deliveryId` becomes the event idempotency key; the downstream durable event store must enforce atomic deduplication.

## Zapier configuration (design/runbook)

1. Add a Catch Hook trigger in Zapier and retain its generated URL as a secret in Zapier.
2. Configure the next action to POST JSON to the TLCE gateway path above.
3. Authenticate the request at the gateway and grant only `integrations.ai-core-bridge.write` to the dedicated automation principal.
4. Send a stable delivery ID for every logical delivery; retries must reuse the same ID.
5. Map the task identifier and input object. Do not send API keys, access tokens, cookies, or other credentials in the payload.
6. Verify the gateway's 202 response and correlate using the returned event ID.

## Security and operational boundaries

- This repository code does not create a public HTTP listener, Zapier account, webhook URL, OpenAI credential, or cloud resource.
- The route relies on the gateway's upstream authentication and capability enforcement. A production deployment must add signature verification or an equivalent authenticated service identity at the HTTP edge, TLS, rate limits, quotas, schema-aware request limits, and abuse monitoring.
- The route publishes an event; it does not call OpenAI. An AI provider adapter must be implemented separately with runtime-injected secrets, bounded output, timeout/cost controls, and data-classification policy.
- The event publisher must be backed by durable storage/queue semantics before production use. In-memory test publishers are test-only.
- Q.P must consume the event through its registered module lifecycle and shared contracts. It must not create a second identity system or runtime.

## Verification

The unit tests cover capability denial, payload validation, event mapping, and request correlation. Passing unit tests do not imply production deployment readiness.

# Zapier Event Bridge — TLCE / QuestPulse

Status: feature-branch adapter implementation added; no live Zapier account connection, staging secret, or production webhook is active.

## 1. Purpose and ownership

Zapier is an external workflow adapter. It is not the TLCE system of record, identity provider, authorization authority, event broker, or runtime engine.

- TLCE owns identity, authorization, canonical content, module lifecycle, audit policy, and event contracts.
- QuestPulse (Q.P) is an internal TLCE module and emits only approved, branch-scoped events through TLCE contracts.
- Zapier may deliver notifications and coordinate approved third-party workflows.
- Q.P must not send credentials, session tokens, personal data, unpublished content, moderation decisions, or unrestricted commands to Zapier.

## 2. Integration direction — phase 1

Start with one-way, allowlisted events from TLCE/Q.P to a dedicated Zapier Catch Hook.

Do not expose a generic Zapier-to-TLCE command endpoint. Any future inbound action must use a separately authenticated, schema-validated, capability-scoped API route with human approval for sensitive operations.

Initial candidate events (disabled until each is approved):
- `qp.submission.received.v1` — opaque submission reference and pending status only.
- `qp.submission.reviewed.v1` — opaque submission reference, final review status, and optional non-sensitive reason code.
- `qp.offer.expiring.v1` — published offer reference and expiry timestamp.
- `tlce.module.health.degraded.v1` — module identifier, degraded health state, and correlation ID.

Do not include full offer bodies, user email, IP address, raw media URLs, access tokens, or free-form moderation notes.

## 3. Event envelope

The existing provider-neutral TLCE event contract is mapped by the adapter to this Zapier-facing envelope:

```json
{
  "event_id": "UUID",
  "event_type": "qp.submission.received.v1",
  "schema_version": 1,
  "occurred_at": "2026-11-14T09:00:00.000Z",
  "producer_module": "questpulse",
  "idempotency_key": "opaque-idempotency-key",
  "data": {
    "submissionRef": "opaque-reference",
    "status": "pending"
  }
}
```

The example is illustrative. IDs must be opaque and contain no embedded personal data.

## 4. Feature-branch implementation

The outbound adapter is implemented at:
- `infrastructure/serverless-edge/zapier/zapier-event-consumer.ts`
- `infrastructure/serverless-edge/zapier/zapier-event-consumer.test.ts`

The adapter:
- accepts only the four explicitly allowlisted event types and schema version 1;
- maps only explicitly approved payload fields, dropping all other fields;
- requires an HTTPS URL on `hooks.zapier.com`, with no URL credentials, query, or fragment;
- signs the exact serialized body using HMAC-SHA256 over `timestamp.body`, and sends timestamp, signature, and event ID headers;
- applies a bounded request timeout and throws on non-2xx responses so the existing event processor can retry and dead-letter;
- is transport-injectable for deterministic tests and does not read secrets from browser/runtime globals.

The adapter is intentionally not wired into a production event processor. It must be constructed only in a server-side composition root using a staging secret. The HMAC headers provide a signature for a downstream verifier; do not assume Zapier Catch Hook validates them itself.

## 5. Delivery and security requirements

Before enabling a Zap:
1. Store the Zapier Catch Hook URL as a server-side secret (for example `ZAPIER_QP_EVENTS_WEBHOOK_URL`); never commit it or place it in browser code.
2. Store a separate signing secret of at least 32 characters server-side; never commit it or expose it to the browser.
3. Use a dedicated hook per environment (development/staging/production) and per event family where practical.
4. Send only an allowlisted event schema over HTTPS.
5. Verify HMAC signature and timestamp at any TLCE-controlled receiver. Reject stale timestamps and invalid signatures. Do not assume Zapier Catch Hook itself verifies custom HMAC headers.
6. Include `event_id` as an idempotency key. Delivery is at-least-once; downstream Zaps must deduplicate.
7. Apply bounded retries with exponential backoff and a durable dead-letter path in TLCE. Do not rely on Zapier task history as the only audit record.
8. Set payload size limits, outbound timeouts, retry limits, and event retention.
9. Redact secrets and personal data from logs. Record delivery outcome, event ID, correlation ID, destination identifier, and timestamps in the parent audit/observability system.
10. Treat Zapier and every connected third-party app as an external processor; review data scope, retention, region, plan limits, and terms before production use.

## 6. Zap configuration runbook

Create a Zap named `TLCE — QuestPulse Event Bridge (Staging)`:

1. Trigger: Webhooks by Zapier → Catch Hook.
2. Copy the generated hook URL into the staging secret store as `ZAPIER_QP_EVENTS_WEBHOOK_URL`.
3. Keep the Zap OFF until the source-side adapter, event allowlist, and secret handling have been reviewed.
4. Add a Filter step that allows only explicitly approved `event_type` values.
5. Add a deduplication step keyed by `event_id` before any external action.
6. Add only the approved destination action (initially a non-sensitive test notification or controlled log).
7. Test with synthetic data; verify the payload, filter, deduplication, and destination result.
8. Enable staging only after all tests pass. Production requires a separate approval and separate credentials.

## 7. Current technical gate

The TLCE repository documents a provider-neutral event envelope and idempotent event processor, but its build-status record explicitly states that durable atomic storage, a production broker/dead-letter adapter, production authentication, and a production HTTP gateway are not yet implemented.

Therefore this document does not claim that a production webhook endpoint exists. Do not point Zapier at a guessed URL, GitHub Pages URL, or the local Q.P prototype API. GitHub Pages cannot execute the Node.js API scaffold.

## 8. Rollout stages

- Stage A — contract and threat review (completed as documentation).
- Stage B — typed, allowlisted Zapier adapter and mocked transport tests (implemented on `feature/zapier-event-bridge`; TypeScript and unit-test CI passed on commit `e7b0c6a`).
- Stage C — configure a staging Catch Hook manually in the user's Zapier account and store its URL as a secret; verify end-to-end using synthetic data.
- Stage D — add durable delivery, replay protection, monitoring, and dead-letter handling.
- Stage E — separate production Zap, credentials, data review, and explicit release approval.

## 9. Non-goals and approval boundaries

This integration does not grant Zapier authority to:
- create or delete users;
- publish, reject, or modify offers;
- change account roles or permissions;
- move money or purchase services;
- migrate or delete data;
- deploy code, alter DNS, or provision paid infrastructure.

Those operations remain in TLCE-controlled authorization flows and require explicit approval where sensitive.

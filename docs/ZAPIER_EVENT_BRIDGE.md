# Zapier Event Bridge — TLCE / QuestPulse

Status: integration design and implementation contract; no live Zapier account connection or production webhook is active.

## 1. Purpose and ownership

Zapier is an external workflow adapter. It is not the TLCE system of record, identity provider, authorization authority, event broker, or runtime engine.

- TLCE owns identity, authorization, canonical content, module lifecycle, audit policy, and event contracts.
- QuestPulse (Q.P) is an internal TLCE module and emits only approved, branch-scoped events through TLCE contracts.
- Zapier may deliver notifications and coordinate approved third-party workflows.
- Q.P must not send credentials, session tokens, personal data, unpublished content, moderation decisions, or unrestricted commands to Zapier.

## 2. Integration direction — phase 1

Start with one-way, outbound, allowlisted events from TLCE/Q.P to a dedicated Zapier Catch Hook.

Do not expose a generic Zapier-to-TLCE command endpoint. Any future inbound action must use a separately authenticated, schema-validated, capability-scoped API route with human approval for sensitive operations.

Initial candidate events (disabled until each is approved):
- `qp.submission.received.v1` — submission reference and status only.
- `qp.submission.reviewed.v1` — submission reference, final review status, and non-sensitive reason code.
- `qp.offer.expiring.v1` — published offer reference and expiry timestamp.
- `tlce.module.health.degraded.v1` — module identifier, health state, correlation ID.

Do not include full offer bodies, user email, IP address, raw media URLs, access tokens, or free-form moderation notes.

## 3. Event envelope

Every outbound event uses this logical envelope:

```json
{
  "event_id": "UUID",
  "event_type": "qp.submission.received.v1",
  "schema_version": 1,
  "occurred_at": "2026-11-14T09:00:00.000Z",
  "producer": {
    "platform": "tlce",
    "module": "questpulse",
    "module_version": "0.1.0"
  },
  "correlation_id": "UUID",
  "data": {
    "submission_ref": "opaque-reference",
    "status": "pending"
  }
}
```

The example is illustrative. IDs must be opaque and contain no embedded personal data.

## 4. Delivery and security requirements

Before enabling a Zap:
1. Store the Zapier Catch Hook URL as a server-side secret (for example `ZAPIER_QP_EVENTS_WEBHOOK_URL`); never commit it or place it in browser code.
2. Use a dedicated hook per environment (development/staging/production) and per event family where practical.
3. Send only an allowlisted event schema over HTTPS.
4. Add an HMAC signature over the exact raw request body plus a timestamp, using a separately stored shared secret; reject stale timestamps and invalid signatures at any TLCE-controlled receiver. Do not assume Zapier Catch Hook itself verifies custom HMAC headers.
5. Include `event_id` as an idempotency key. Delivery is at-least-once; downstream Zaps must deduplicate.
6. Apply bounded retries with exponential backoff and a durable dead-letter path in TLCE. Do not rely on Zapier task history as the only audit record.
7. Set payload size limits, outbound timeouts, retry limits, and event retention.
8. Redact secrets and personal data from logs. Record delivery outcome, event ID, correlation ID, destination identifier, and timestamps in the parent audit/observability system.
9. Treat Zapier and every connected third-party app as an external processor; review data scope, retention, region, plan limits, and terms before production use.

## 5. Zap configuration runbook

Create a Zap named `TLCE — QuestPulse Event Bridge (Staging)`:

1. Trigger: Webhooks by Zapier → Catch Hook.
2. Copy the generated hook URL into the staging secret store as `ZAPIER_QP_EVENTS_WEBHOOK_URL`.
3. Keep the Zap OFF until the source-side adapter, event allowlist, and secret handling have been reviewed.
4. Add a Filter step that allows only explicitly approved `event_type` values.
5. Add a deduplication step keyed by `event_id` before any external action.
6. Add only the approved destination action (initially a non-sensitive test notification or controlled log).
7. Test with synthetic data; verify the payload, filter, deduplication, and destination result.
8. Enable staging only after all tests pass. Production requires a separate approval and separate credentials.

## 6. Current technical gate

The TLCE repository documents a provider-neutral event envelope and idempotent event processor, but its build-status record explicitly states that durable atomic storage, a production broker/dead-letter adapter, production authentication, and a production HTTP gateway are not yet implemented.

Therefore this document does not claim that a production webhook endpoint exists. Do not point Zapier at a guessed URL, GitHub Pages URL, or the local Q.P prototype API. GitHub Pages cannot execute the Node.js API scaffold.

## 7. Rollout stages

- Stage A — contract and threat review (this document).
- Stage B — implement a typed Zapier adapter behind the TLCE event interface on a feature branch, with unit tests and a mocked HTTP transport.
- Stage C — configure a staging Catch Hook manually in the user's Zapier account and store its URL as a secret; verify end-to-end using synthetic data.
- Stage D — add durable delivery, replay protection, monitoring, and dead-letter handling.
- Stage E — separate production Zap, credentials, data review, and explicit release approval.

## 8. Non-goals and approval boundaries

This integration does not grant Zapier authority to:
- create or delete users;
- publish, reject, or modify offers;
- change account roles or permissions;
- move money or purchase services;
- migrate or delete data;
- deploy code, alter DNS, or provision paid infrastructure.

Those operations remain in TLCE-controlled authorization flows and require explicit approval where sensitive.

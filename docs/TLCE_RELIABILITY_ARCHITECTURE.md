# TLCE Reliability Architecture — Event Delivery, Security, and Operations

Status: architecture specification on `feature/zapier-event-bridge`. This document defines the next implementation boundary; it does not claim that production persistence, authentication, deployment, or a live Zapier connection exists.

## 1. System ownership

- **The Last Cosmic Explosion (TLCE)** is the parent application and authoritative system of record.
- **QuestPulse (Q.P)** is an internal module. It publishes domain events through TLCE-owned contracts and does not connect directly to third-party automation services.
- **Automation adapters** (Zapier initially) are replaceable outbound consumers. They cannot own identity, permissions, canonical data, business rules, or module lifecycle.
- **Human approval** remains mandatory before external communications, GitHub issue creation, publication/moderation changes, deployments, billing, or destructive actions.

## 2. Target architecture

```text
QuestPulse / TLCE modules
        |
        v
Domain event contract + schema validation
        |
        v
Transactional Outbox (same DB transaction as domain change)
        |
        v
Dispatcher / Lease Manager
        |
        +--> Internal consumers
        |
        +--> Provider-neutral delivery interface
                    |
                    v
              Zapier adapter (optional)
                    |
                    v
              Approved Zap workflows
        |
        v
Delivery attempts + audit metadata + metrics
        |
        +--> Retry scheduler
        +--> Dead-letter store / operator replay
```

The diagram is a target design. The transactional outbox, persistent lease manager, production adapters, and deployment are not yet implemented.

## 3. Event contract

Every event must include:
- `eventId`: globally unique opaque identifier.
- `eventType` and `schemaVersion`: explicit versioned contract.
- `occurredAt`: UTC ISO-8601 timestamp.
- `producerModule`: registered TLCE module identifier.
- `idempotencyKey`: stable logical operation key.
- `payload`: schema-validated object containing only approved fields.

Validation requirements:
1. Reject unknown event types and unsupported schema versions.
2. Enforce maximum payload size and per-field length limits.
3. Reject malformed timestamps and invalid enum values.
4. Strip unknown payload fields by constructing a new allowlisted object; never forward the caller's object wholesale.
5. Prohibit credentials, session tokens, personal data, raw moderation notes, and unrestricted URLs in external event payloads.
6. Treat event payloads and all third-party responses as untrusted data.

## 4. Transactional outbox and delivery state

Implement a database-backed outbox before production delivery. The domain mutation and outbox insert must commit atomically in one database transaction. Do not publish externally from inside a domain request before its transaction commits.

Suggested logical record:
- `event_id` (unique primary key)
- `event_type`, `schema_version`, `producer_module`
- `occurred_at`, `created_at`
- `payload_json` (validated, minimized payload)
- `status`: pending | leased | delivered | dead_letter
- `attempt_count`, `next_attempt_at`
- `lease_owner`, `lease_expires_at`
- `last_error_code` (sanitized, bounded; no secrets)
- `delivered_at`, `destination_id`

Required invariants:
- Unique `event_id` prevents duplicate event insertion.
- Lease acquisition must be atomic and safe across concurrent workers.
- Expired leases return to retryable state.
- A delivery attempt is recorded before/after network I/O without losing the event on worker crash.
- Mark delivered only after a successful destination response.
- At-least-once delivery is expected. Every consumer must deduplicate by `event_id` or the stable idempotency key.
- Retention and deletion policies must be explicit and auditable.

Do not use Zapier task history as the canonical delivery ledger.

## 5. Retry and dead-letter policy

- Retry only transient network errors, timeouts, HTTP 408, HTTP 429, and HTTP 5xx responses.
- Treat schema/configuration errors and most HTTP 4xx responses as permanent until corrected.
- Use bounded exponential backoff with jitter and a configurable maximum attempt count.
- Respect a valid `Retry-After` value, bounded by the system's maximum retry window.
- Move exhausted or permanently failed events to a durable dead-letter store.
- Provide operator-only inspection and replay. Replay must preserve the original event ID or record an explicit replay lineage; it must not silently create a new business event.
- Never log authorization headers, hook URLs, signing secrets, full sensitive payloads, or raw provider response bodies.

## 6. Zapier adapter boundary

The current feature-branch adapter is a typed outbound adapter with:
- four event types in an explicit allowlist;
- payload field reconstruction;
- HTTPS Catch Hook host/path validation;
- HMAC-SHA256 request signing;
- an 8 KiB payload cap and bounded request timeout;
- injectable transport for deterministic unit tests.

Important limitations:
- Zapier Catch Hook does not thereby become an HMAC-verifying receiver. Do not interpret the custom signature header as authentication accepted by Zapier.
- The Catch Hook URL itself is a bearer-like secret and must be stored server-side.
- The adapter must be instantiated only in a server-side composition root.
- It must be invoked by the durable dispatcher, not directly from browser code or a Q.P UI.
- The current Zapier Free plan does not include the standard Webhooks Catch Hook trigger; no paid plan, trial, or usage billing may be enabled without explicit approval.
- No live Zap, secret, endpoint, or production connection is active.

## 7. Security architecture

Before production:
1. Add production authentication at the HTTP/API boundary (JWT/OIDC or an equivalent reviewed identity system).
2. Enforce deny-by-default module permissions and capability-scoped service access.
3. Validate request bodies against versioned schemas at ingress.
4. Apply per-user and per-client quotas, rate limits, payload limits, and timeouts.
5. Store credentials in a managed server-side secret store; rotate and audit access.
6. Apply network egress controls, DNS resolution/pinning, redirect revalidation, and private-address blocking to outbound HTTP.
7. Separate development, staging, and production credentials, databases, and destinations.
8. Redact personal data and secrets from application, worker, and audit logs.
9. Apply least-privilege scopes to every connected third-party app.
10. Run threat modeling and dependency/security review before enabling external actions.

## 8. Audit and observability

Persist append-only audit metadata for:
- event creation and producer module;
- validation result and schema version;
- dispatch attempt number and destination identifier;
- attempt start/end timestamps and outcome category;
- retry scheduling and dead-letter transition;
- operator replay identity, reason, and lineage.

Expose metrics without sensitive payloads:
- pending outbox depth and oldest-event age;
- delivery success/failure rates;
- retry counts and dead-letter count;
- worker lease expiry/recovery count;
- per-destination latency and timeout rate.

Alert thresholds and retention must be configured with the production operator. No monitoring service is currently provisioned.

## 9. Human approval gates

Require an explicit human approval record before:
- sending email, messages, or stakeholder notifications externally;
- creating GitHub issues or changing project state;
- publishing or moderating user-facing content;
- changing roles, permissions, or account state;
- deploying, changing DNS, provisioning infrastructure, or spending money;
- replaying a dead-letter event that could trigger an external side effect.

An approval record should bind the approver, exact action, exact payload/destination, timestamp, and expiry. Approval must not be inferred from a successful AI classification.

## 10. Implementation sequence

1. **Contract hardening:** schema definitions, validation tests, compatibility policy, and event catalog.
2. **Persistence:** select a database already approved for TLCE; implement transactional outbox migrations and atomic lease operations.
3. **Dispatcher:** implement concurrency-safe leasing, bounded retries, backoff/jitter, and durable dead-letter storage.
4. **Provider-neutral delivery:** define adapter interface and deterministic failure simulation.
5. **Zapier staging:** only after plan eligibility and explicit approval; use synthetic data and server-side secrets.
6. **Security and audit:** authentication, authorization, egress policy, persistent audit sink, and operational metrics.
7. **Production readiness review:** backup/restore, retention, incident runbook, load tests, failure injection, and independent approval.

Do not skip from step 1 to live Zapier delivery. A green unit-test run is not a production reliability guarantee.

## 11. Current readiness statement

Implemented on the feature branch: TLCE module/runtime foundations, provider-neutral event envelope, idempotent event-processing contract, and the mocked Zapier adapter/tests.

Not yet production-ready: durable atomic outbox storage, production broker/storage adapter, persistent dead-letter sink, production authentication, hardened HTTP server, network egress enforcement, persistent audit sink, monitoring, deployment, and live Zapier configuration.

The next code milestone is the transactional outbox and lease-backed dispatcher, using a database choice already present and approved in the repository. Do not invent a database provider or provision paid infrastructure as part of this milestone.

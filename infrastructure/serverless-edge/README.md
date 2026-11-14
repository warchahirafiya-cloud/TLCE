# TLCE Serverless & Edge Infrastructure

This directory contains the provider-neutral infrastructure boundary shared by TLCE Core, the independent Runtime Engine, and internal product modules.

## Boundaries
- `contracts/`: TLCE-owned interfaces and shared types.
- `runtime/`: runtime integration and execution policies.
- `functions/`: serverless function entry points.
- `edge-gateway/`: edge request routing and gateway policies.
- `distributed-cache/`: cache abstractions and namespace policy.
- `event-processing/`: event envelopes, queues, retries, and idempotency.
- `security/`: security controls and policy adapters.
- `monitoring/`: telemetry contracts and health reporting.
- `providers/`: vendor-specific adapters only.

Do not import provider SDKs outside `providers/`. Keep secrets out of this repository. No cloud resource is provisioned by this scaffold.


## Durable event delivery adapters
- `runtime/postgres-event-store.ts`: PostgreSQL-backed idempotency claims with expiring leases and durable dead-letter upserts.
- `runtime/postgres-event-outbox.ts`: transactional outbox writer plus worker batch claim, acknowledgement and retry release operations.
- `migrations/001_event_delivery.sql` and `migrations/002_event_outbox.sql`: database schema.
- Producers must write their domain changes and outbox event using the same database transaction. The dispatcher is at-least-once: consumers and downstream broker operations must be idempotent.
- Production deployment must inject a trusted PostgreSQL executor, apply migrations, configure connection pooling, backups, retention, monitoring and lease durations. No database is provisioned or migration executed by this repository change.

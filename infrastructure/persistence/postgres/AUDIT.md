# PostgreSQL Audit Sink

Status: append-only audit writer implementation; not yet connected to a deployed runtime.

## Components

- `infrastructure/persistence/postgres/src/postgres-audit-sink.ts` implements the core `AuditSink` interface.
- `infrastructure/persistence/postgres/migrations/002_audit_records.sql` creates the audit table and query indexes.
- `infrastructure/persistence/postgres/test/postgres-audit-sink.test.ts` verifies parameterized writes, validation and failure propagation.

## Runtime integration

Inject a trusted server-side PostgreSQL query executor. Use a dedicated database role that has INSERT but not UPDATE, DELETE or TRUNCATE on `tlce_audit_records`. Keep audit storage credentials separate from session storage credentials where operationally practical. Configure TLS certificate verification, network restrictions, backups, retention and monitoring.

The sink revalidates every record through `createAuditRecord` before persistence. Database failures are intentionally propagated so `DeveloperConsoleService` can fail closed and avoid returning protected data without an audit event.

No read/query API, retention deletion worker, tamper-evident hash chain, external immutable archive, database provisioning or production runtime wiring is included yet. Do not claim compliance or immutable/WORM audit storage based solely on this implementation.

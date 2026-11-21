# PostgreSQL Operator Session Store

Status: implementation adapter; not yet enabled in a deployed runtime.

## Components

- `core/identity/src/operator-session.ts` defines the session lifecycle and storage contract.
- `infrastructure/persistence/postgres/src/postgres-operator-session-store.ts` implements that contract over a pg-compatible parameterized query executor.
- `infrastructure/persistence/postgres/migrations/001_operator_sessions.sql` defines the table and expiry index.
- `infrastructure/persistence/postgres/test/postgres-operator-session-store.test.ts` covers SQL shape, parameterization, row validation and bounded cleanup.

## Runtime integration requirements

1. Provision a managed PostgreSQL database with TLS certificate verification and private network access.
2. Inject a configured `pg.Pool` (or compatible executor) from the trusted server runtime. Do not expose database credentials to browser code.
3. Apply the migration using a controlled migration runner and least-privilege database role.
4. Construct `PostgresOperatorSessionStore` and inject it into `OperatorSessionService`.
5. Run `deleteExpired(nowMs, batchSize)` from a scheduled maintenance worker and alert on repeated failures.
6. Configure connection pool limits, statement timeouts, backups, restore tests, secret rotation and database availability monitoring.

## Security properties and limits

- Only SHA-256 digests are accepted for session and CSRF tokens; raw bearer tokens are never persisted by this adapter.
- All user-controlled values use PostgreSQL bind parameters.
- Roles and module scopes are validated when records are read back.
- Expiry cleanup uses bounded batches and `FOR UPDATE SKIP LOCKED` to permit multiple workers.
- This adapter does not provision PostgreSQL, create credentials, configure TLS, provide OAuth, or constitute a production deployment.
- The executor must be a trusted server-side PostgreSQL connection. Never instantiate it in a browser or public GitHub Pages bundle.

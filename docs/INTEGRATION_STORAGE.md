# Integration Control Plane persistence

This branch now defines repository ports and a PostgreSQL reference migration. These are implementation contracts and schema source, not a provisioned database.

## Data boundaries
- Connection records store provider/tenant identifiers, lifecycle, verification state, granted scopes and an opaque secret reference. They never store access or refresh tokens.
- Grants are tenant + principal + provider scoped and carry resource patterns, permission tiers, operation allowlists, expiry and revocation.
- OAuth transactions persist only a hash of callback state, a KMS-encrypted PKCE verifier, tenant/principal/provider binding, browser-session hash, exact redirect URI and expiry.
- Audit events are metadata-only and protected from ordinary UPDATE/DELETE/TRUNCATE by SQL grants; privileged database administrators remain within the infrastructure trust boundary.

## Tenant isolation
The migration enables PostgreSQL row-level security on every tenant-owned table. The trusted server must set the tenant context inside each transaction after authenticating the caller. Never accept this setting directly from a browser or user-supplied request field. Production roles must not have BYPASSRLS; table owners and superusers require separate operational controls.

## Concurrency and expiry
Connection lifecycle writes use compare-and-set against the expected lifecycle. OAuth state consumption must be atomic (delete/return in one transaction) and reject expired, replayed or session-mismatched callbacks. Expired transaction cleanup should run under a bounded maintenance role.

## Remaining production gates
1. Choose and provision PostgreSQL in an approved environment; no database has been created by this commit.
2. Implement repository adapters using parameterized SQL and transaction-scoped tenant context.
3. Implement atomic OAuth transaction put/consume with KMS envelope encryption for verifier bytes.
4. Provision a KMS-backed secret vault and append-only audit role.
5. Add migration tests against the selected PostgreSQL version, RLS cross-tenant tests, concurrency tests and backup/restore verification.
6. Security-review connection creation, tenant identity propagation, privilege boundaries and audit retention before enabling any external provider.


## Security refinements
- Row-level security is both enabled and forced on tenant-owned tables.
- OAuth callback consumption must atomically match tenant, principal and browser-session hash before deleting/returning a transaction. A mismatch must not consume the valid transaction.
- The application should hash callback state before storage and encrypt PKCE verifier bytes using a KMS-backed envelope key.
- Lifecycle transitions into connected require fresh provider verification evidence. A state label is not proof of connectivity.

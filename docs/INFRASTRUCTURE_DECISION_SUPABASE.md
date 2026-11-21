# TLCE infrastructure decision: Supabase-first

Status: Accepted for the initial development and pilot environment
Decision date: 2026-11-21
Scope: Infrastructure direction only; no external resources are provisioned by this change.

## Decision

Use Supabase as the managed PostgreSQL platform for TLCE's initial environment. Keep the existing provider-neutral PostgreSQL persistence adapters and the Node.js application runtime.

Supabase is the database platform in this decision, not a replacement for the complete application runtime.

## Why this is the fastest low-complexity path

- TLCE already has PostgreSQL persistence adapters behind the small `PostgresQueryExecutor` interface.
- Supabase provides managed PostgreSQL and a dashboard without requiring a database server to be operated by the project.
- Keeping the current Node.js runtime avoids a premature rewrite for Deno/Supabase Edge Functions.
- Existing SQL remains PostgreSQL-oriented and can be rehearsed before it is applied to a remote project.
- Provider-specific code remains outside TLCE core and persistence contracts.

## Target initial architecture

1. **Application runtime:** Node.js host compatible with the repository's current ESM/TypeScript build and long-running HTTP requirements. The exact free host is a separate compatibility decision; do not deploy this private operator API to GitHub Pages.
2. **Database:** Supabase-managed PostgreSQL, accessed over TLS with certificate validation through a least-privilege application database role.
3. **Authentication and authorization:** Keep TLCE-owned OAuth, session, role, MFA challenge, and audit logic. Do not silently replace the current identity model with Supabase Auth.
4. **TOTP encryption:** Keep the `TotpKms` abstraction. Supabase PostgreSQL is not the TOTP key-management service. A development/pilot secret may be injected through the application host's secret environment only after an explicit key-management decision; this does not satisfy the production managed-KMS requirement.
5. **Rate limiting:** Do not add Redis until a distributed limiter is required by the selected runtime and threat model. Do not treat in-memory limits as sufficient for multiple instances.
6. **Edge protections:** Require HTTPS, request/body/header limits before buffering, duplicate security-header rejection, trusted-proxy configuration, secure cookies, and log redaction at the public HTTP host/proxy boundary.

## Compatibility constraints

- Preserve the existing `PostgresQueryExecutor` abstraction.
- Use a PostgreSQL driver/pool in the Node.js host and inject its query surface into the existing runtime composition.
- Use the Supabase direct database connection only from a compatible server runtime; choose the Supabase pooler connection mode if the host's network topology requires it. Never expose database credentials to browser code.
- Do not move privileged OAuth/MFA routes into browser code or public static hosting.
- Do not introduce Supabase Auth as a parallel source of TLCE roles or privileged identity without a separate architecture review.

## Database rollout sequence

1. Inventory every existing migration and establish the required order.
2. Create a separate Supabase development project only after the project owner completes account setup and confirms the target region.
3. Apply migrations to the development project only, using the controlled migration workflow.
4. Verify schema, constraints, indexes, grants, and transaction behavior.
5. Run PostgreSQL adapter integration tests against that project.
6. Rehearse backup/export and restore before any production data is stored.
7. Keep production credentials, project references, and connection strings outside Git.

## Security gates before privileged pilot access

- A production-grade `TotpKms` implementation or an explicitly approved interim key-management design.
- TLS-verified database connectivity and least-privilege grants.
- Distributed account/IP/challenge rate limiting where multiple runtime instances are used.
- Host-level body/header limits, duplicate-header rejection, trusted proxy configuration, HTTPS/HSTS, and secret-safe logs.
- OAuth callback/origin configuration and audited operator-account linking.
- Concurrency/replay tests, migration rehearsal, independent security review, and restore/rollback rehearsal.

## Explicitly not done

- No Supabase account or project has been created.
- No region has been selected and no paid/free quota has been consumed.
- No database migration has been applied remotely.
- No credentials, secrets, API keys, or connection strings have been created or committed.
- No application host, production listener, DNS, or deployment has been configured.
- No PR has been merged and no production-readiness claim is made.

## Follow-up

The next engineering task is to inventory all PostgreSQL migrations and add a reproducible Supabase CLI migration path. In parallel, inspect the existing runtime/build structure to select the simplest compatible Node.js host without changing the application architecture.

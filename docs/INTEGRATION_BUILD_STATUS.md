# Integration Control Plane — Build Status

Reviewed: 2026-11-14
Branch: `feature/integration-control-plane`
Base: `feature/mcp-infrastructure-2026-11-14`

## Delivered in this branch
- External integration architecture, lifecycle, permission tiers, consent rules and security gates.
- Deduplicated owner-nominated integration catalogue, grouped by business capability.
- Initial machine-readable provider registry with 38 high-priority candidates.
- Typed TypeScript contracts for provider descriptors, grants, operation requests and authorization decisions.
- Deny-by-default authorization enforcing provider enablement, tenant, principal, resource, operation, permission, expiry and revocation.
- Separate owner confirmation gate for financial operations.
- Registry validation for unique IDs, HTTPS origins, lifecycle consistency and connection truthfulness.
- Unit tests for authorization and registry invariants.
- Root typecheck and test commands extended to include integration core source/tests.

## Not delivered / not claimed
- No provider account registration or OAuth connection has been completed.
- No API keys, OAuth clients, tokens, secrets or user data have been collected or stored.
- No provider-specific API adapter is connected.
- No database, secret vault, durable audit sink or production deployment has been provisioned.
- No paid plan, subscription, cloud resource, payment, trade or legal action has been initiated.
- Catalogue presence does not mean API availability, product identity verification, regional availability or account entitlement.

## Validation
GitHub Actions is the authoritative validation path for this branch. Record the exact run URL, head SHA and conclusion after the workflow finishes. A running or queued workflow is not a pass.

## Next engineering gates
1. Confirm CI passes at the latest branch head.
2. Add provider metadata discovery and connection state persistence behind Core interfaces.
3. Implement a secret-vault adapter and durable append-only audit sink.
4. Implement one read-only provider adapter in staging after interactive owner OAuth consent.
5. Add provider-specific scopes, webhook validation, contract tests and revocation handling.
6. Review high-risk legal, healthcare, finance and advertising connectors separately.
7. Keep all production deployment, billing, financial actions and merge-to-main decisions behind explicit approval.


## Additional delivery — OAuth and connection lifecycle
- Added OAuth authorization-start primitives using authorization-code + PKCE S256.
- Added cryptographically random per-attempt state and verifier, bounded TTL, HTTPS endpoint validation, and one-time callback-state consumption.
- Added provider adapter, secret vault and metadata-only audit sink interfaces.
- Added a guarded connection lifecycle state machine: catalogue → review → consent → connected → health-checked → enabled; revocation is terminal.
- Added tests for OAuth PKCE/state replay/expiry and lifecycle transition guards.
- Fixed parameter validation ordering so invalid reserved OAuth parameters are rejected before a transaction is persisted.
- These are framework primitives and interfaces only. Durable stores, token exchange, issuer validation, real vault/audit implementations and live provider consent are not yet implemented.

Security baseline: [IETF RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html).


## Additional delivery — unified execution gateway
- Added a single integration gateway that resolves provider, grant and adapter, then runs the deny-by-default policy before execution.
- Added adapter-operation metadata checks to prevent the adapter from silently broadening operation permissions.
- Added metadata-only audit events for denied, allowed, succeeded and failed operations, correlated by request ID.
- Added tests covering successful execution, resource-scope denial, financial confirmation and provider execution failure.
- GitHub Actions run #391 completed type checking and unit tests successfully for the gateway implementation. The run's final cleanup was still finishing at the time of this update.


## Additional delivery — durable persistence boundaries and security hardening
- Added tenant-scoped repository contracts for connections, grants, provider registry and OAuth transactions, including compare-and-set lifecycle transitions.
- Added PostgreSQL reference migration for tenant-owned connections, grants, OAuth transaction metadata and audit events.
- Enabled and forced row-level security on tenant-owned tables; documented trusted transaction-local tenant identity requirements.
- OAuth start now binds every transaction to an authenticated tenant, principal and hashed browser session. Callback state is atomically consumed only for the matching binding; mismatched sessions do not burn the legitimate transaction.
- Connection lifecycle now requires fresh explicit verification evidence before the connected state can be entered. Verification is no longer inferred from the lifecycle label.
- Audit events receive distinct cryptographically random identifiers to avoid collisions between allowed/succeeded/failed events for one operation.
- PostgreSQL and KMS adapters remain unimplemented; migration is reference source only and has not been applied to a live database.


## Additional delivery — PostgreSQL repository adapter
- Implemented driver-neutral PostgreSQL adapters for connection records, grants, OAuth transaction storage and audit insertion.
- Every repository operation establishes a transaction-local tenant context before touching RLS-protected tables.
- Connection lifecycle updates use compare-and-set; OAuth state hashes are stored instead of raw state, PKCE verifier bytes pass through an injected cipher, and callback consumption binds tenant/principal/session/expiry in one DELETE ... RETURNING operation.
- The database pool, KMS-backed verifier cipher, database provisioning, migration execution and live database integration tests remain deployment-specific and are not present in this repository.

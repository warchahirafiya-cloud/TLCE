# TLCE Implementation Roadmap

## Completed repository foundation

- [x] Hierarchical parent-platform architecture; QuestPulse is an internal module, not a standalone parent application.
- [x] Module manifests, dependency resolver, permission declarations and lifecycle contracts.
- [x] Runtime registry validation and defensive snapshots.
- [x] Serialized module startup and shutdown; deny-by-default grants and immutable context.
- [x] Health report validation and startup failure cleanup.
- [x] API gateway request/path validation, capability checks and error isolation.
- [x] Idempotent event processor with bounded retries and a dead-letter sink interface.
- [x] Outbound HTTP URL validation, DNS A/AAAA checks, public-address filtering, selected-IP pinning, redirect revalidation, HTTPS downgrade rejection, response-size limits and request timeouts.
- [x] LLM7 proxy request validation and fail-closed security-policy injection boundary.
- [x] Audit record constructor with secret-bearing metadata rejection.
- [x] Automated tests for implemented contracts and security boundaries.
- [x] QuestPulse integration ownership contract and migration constraints.
- [x] Security threat model and explicit production release gates.
- [x] GitHub Pages build and deployment verified on the current main baseline.

## Remaining work before a production candidate

1. **Durable events:** implement and contract-test a durable idempotency store with atomic claims, leases, crash recovery and retention; add durable broker and dead-letter adapters plus replay/poison-message procedures.
2. **Network egress:** add network-level private-range and cloud-metadata blocking around the existing DNS-aware, IP-pinned outbound HTTP helper.
3. **Execution isolation:** implement signed module artifacts and a hardened process/container isolation boundary before any dynamic module loading.
4. **Production identity and gateway:** implement OIDC/JWT verification, schema validation, shared rate limiting, quotas, tenant isolation and an actual HTTP/edge adapter.
5. **Persistent audit:** implement an append-only audit sink, access controls, encryption, retention and operational alerts.
6. **Operations:** implement configuration schema validation, secret injection, structured telemetry, traces, health/readiness probes and SLOs.
7. **Supply-chain reproducibility:** commit a dependency lockfile, move CI to `npm ci`, and add SBOM, dependency and secret scans.
8. **QuestPulse source integration:** obtain and review authoritative Q.P source; map legacy routes/tables and write field-level migration and contract tests. The original `app.asar` remains read-only and must not be changed.
9. **Frontend verification:** complete production smoke verification (PR #20) and UI interaction contract tests (PR #21); add real-browser E2E coverage when a supported browser runner is introduced.
10. **Release readiness:** complete integration, threat-model review, abuse-case tests and independent security review. Evaluate staging and rollback only after explicit approval.

## Release policy

Keep implementation work on feature branches until CI passes on the exact head, source integration is reviewed and security gates pass. Main-branch merges, production deployments, DNS changes, paid resources, secret provisioning and production data migrations remain gated by explicit approval. A green CI run is not a production-readiness certificate.

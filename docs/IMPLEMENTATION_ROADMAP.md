# TLCE Implementation Roadmap

## Completed repository foundation
- [x] Hierarchical parent-platform architecture and provider-neutral serverless/edge contracts.
- [x] Module manifests, dependency resolver, permission declarations and lifecycle contracts.
- [x] Runtime registry validation and defensive snapshots.
- [x] Serialized module startup and shutdown; deny-by-default grants and immutable context.
- [x] Health report validation and startup failure cleanup.
- [x] API gateway request/path validation, capability checks and error isolation.
- [x] Idempotent event processor with bounded retries and dead-letter sink interface.
- [x] Outbound URL syntax guard for local/private literal targets.
- [x] Audit record constructor with secret-bearing metadata rejection.
- [x] Automated tests for implemented contracts and security boundaries.
- [x] QuestPulse integration ownership contract and migration constraints.
- [x] Security threat model and explicit production release gates.

## Remaining work before a production candidate
1. Implement and contract-test a durable idempotency store with atomic claims, leases, crash recovery and retention.
2. Implement durable broker/queue and dead-letter adapter; define replay and poison-message procedures.
3. Implement DNS-aware outbound egress proxy with address pinning, redirect validation and network-level private-range blocking.
4. Implement signed module artifacts and a hardened process/container isolation boundary before any dynamic module loading.
5. Implement production authentication (OIDC/JWT verification), schema validation, rate limiting, quotas and tenant isolation at the gateway.
6. Implement persistent audit sink, audit access controls, encryption, retention and operational alerts.
7. Implement configuration schema validation, secret injection, structured telemetry, traces and SLOs.
8. Obtain and review authoritative QuestPulse source; map legacy routes/tables and write field-level migration and contract tests.
9. Complete integration, threat-model review, abuse-case tests, SBOM/dependency/secret scans and independent security review.
10. Evaluate staging deployment and rollback only after explicit approval.

## Release policy
Remain on the feature branch until CI passes on the current head, source integration is reviewed, security gates pass and maintainers approve. Do not merge into main, deploy, alter DNS, provision paid resources or migrate production data without explicit approval.

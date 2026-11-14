# TLCE Implementation Roadmap

## Completed repository foundation
- [x] Runtime environment configuration parser with fail-closed production checks and tests; CI now discovers all core package test folders.
- [x] Hierarchical parent-platform architecture and provider-neutral serverless/edge contracts.
- [x] Module manifests, dependency resolver, permission declarations and lifecycle contracts.
- [x] Runtime registry validation and defensive snapshots.
- [x] Serialized module startup and shutdown; deny-by-default grants and immutable context.
- [x] Health report validation and startup failure cleanup.
- [x] API gateway request/path validation, capability checks and error isolation.
- [x] Protected AI Core Bridge ingress route, strict payload validation, and versioned QuestPulse event publication.
- [x] Idempotent event processor with bounded retries and dead-letter sink interface.
- [x] PostgreSQL durable deduplication/dead-letter adapter and transactional outbox adapter with migrations and tests.
- [x] QuestPulse task worker contract with provider-neutral executor injection, execution timeout/cancellation, bounded JSON input/output and result persistence contract.
- [x] PostgreSQL first-write-wins task result sink with taskId uniqueness, bounded serialization and migration.
- [x] Outbound URL syntax guard for local/private literal targets.
- [x] Automated tests for implemented contracts and security boundaries.
- [x] QuestPulse integration ownership contract and migration constraints.
- [x] Security threat model and explicit production release gates.

## Remaining work before a production candidate
1. Deploy the outbox dispatcher as a supervised worker process and add PostgreSQL/broker integration tests for crash recovery, redelivery, poison messages and lease renewal.
2. Connect and integration-test the PostgreSQL task result sink; implement provider-side idempotency so external side effects cannot duplicate on retries.
3. Deploy and integration-test PostgreSQL idempotency, dead-letter and transactional outbox adapters against a managed database; validate concurrent claims, lease expiry, process crashes, outbox redelivery, retention and backup/restore.
4. Implement DNS-aware outbound egress proxy with address pinning, redirect validation and network-level private-range blocking.
5. Implement signed module artifacts and a hardened process/container isolation boundary before any dynamic module loading.
6. Implement production authentication (OIDC/JWT verification), schema validation, rate limiting, quotas and tenant isolation at the gateway.
7. Deploy and secure the AI Core Bridge HTTP ingress; add provider signature/service-identity verification, then implement a production AI provider adapter with runtime-injected secrets and cost/data controls.
8. Implement persistent audit sink, audit access controls, encryption, retention and operational alerts.
9. Implement configuration schema validation, secret injection, structured telemetry, traces and SLOs.
10. Obtain and review authoritative QuestPulse source; map legacy routes/tables and write field-level migration and contract tests.
11. Complete integration, threat-model review, abuse-case tests, SBOM/dependency/secret scans and independent security review.
12. Evaluate staging deployment and rollback only after explicit approval.

## Release policy
Remain on the feature branch until CI passes on the current head, source integration is reviewed, security gates pass and maintainers approve. Do not merge into main, deploy, alter DNS, provision paid resources or migrate production data without explicit approval.


## Production activation gates (ordered)

1. **Identity provider:** choose OIDC provider, register TLCE audiences/clients, implement and review a JWKS-backed verifier, then wire it at the trusted HTTP edge.
2. **Runtime boundary:** choose the deployment target and implement a hardened isolated module execution boundary; do not load untrusted modules in-process.
3. **Persistence:** provision PostgreSQL outside this repository, apply migrations 001–003, configure backups, retention, pooling and restore drills.
4. **Workers and AI:** configure a durable worker process, provider adapter, secret storage, quotas, timeouts, idempotency and failure monitoring.
5. **Edge security:** deploy an HTTP gateway with request schema validation, rate limiting, TLS, trusted proxy configuration, DNS/egress controls and redirect revalidation.
6. **Audit and operations:** add persistent audit storage, alerting, dashboards, health probes, incident response and operational runbooks.
7. **Release rehearsal:** run integration/security tests against staging, backup/restore and crash-recovery drills, then obtain explicit production deployment approval.

No credentials, external infrastructure or production services are assumed to exist. Feature branch CI is not a deployment approval.

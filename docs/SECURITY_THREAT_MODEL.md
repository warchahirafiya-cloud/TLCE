# TLCE Security Threat Model — Foundation

Reviewed: 2026-11-14
Scope: repository-level contracts and in-process foundation only. This is not a production penetration test or formal security certification.

## Assets
Central identity and authorization decisions; module manifests and permissions; event payloads and idempotency; module/user data; audit records; outbound network access and provider credentials.

## Trust boundaries
1. External clients to API gateway.
2. Product modules to TLCE Core capabilities.
3. Runtime Engine to module implementation.
4. Event producer to broker to consumer.
5. Infrastructure adapters to third-party providers and outbound hosts.

## Threats and baseline controls

| Threat | Repository baseline | Remaining production requirement |
| --- | --- | --- |
| Excessive module permissions | Deny-by-default grants; grants limited to declared permissions; immutable context | Central policy, signed approval, revocation and audit integration |
| Concurrent lifecycle calls | Runtime serializes start/stop per module | Distributed coordination for multiple runtime instances |
| Malformed health responses | Runtime validates lifecycle state and timestamp | Readiness probes, watchdog, SLOs and alerts |
| API path traversal | Router rejects traversal, encoded separators, query/fragment and invalid request IDs | Proxy canonicalization and real-server integration tests |
| SSRF | URL helper blocks local hostnames and private/reserved literal IPs | DNS-aware egress proxy, IP pinning, redirect revalidation and network firewall |
| Duplicate event delivery | Idempotent processor and store contract | Durable atomic claims, lease expiry, transactional completion and crash recovery |
| Repeated event failure | Bounded exponential retries and DLQ interface | Durable broker/DLQ, replay tooling and alerts |
| Secrets in audit metadata | Constructor rejects sensitive keys and bounds values | Persistent sink controls, encryption, retention and redaction review |
| Compromised module code | No dynamic loading enabled | OS/container isolation, quotas, network policy, signed artifacts and sandbox review |

## Mandatory production gates
- Never execute untrusted module code inside the Runtime Engine process.
- Do not treat the SSRF syntax helper as complete SSRF protection.
- Do not use in-memory idempotency storage in production.
- Require durable atomic claims with expiring leases and crash recovery.
- Authenticate external requests at a trusted edge and validate schemas.
- Store secrets only in managed secret storage and inject them at runtime.
- Define tenant isolation, data classification, residency, retention and deletion.
- Add dependency/secret scanning, SBOM, artifact provenance and signed releases.
- Complete abuse-case testing and independent security review before production.

## Known limitations
No production HTTP listener, authentication provider, persistent database, event broker, dead-letter service, DNS-aware egress proxy, module sandbox, cloud deployment or observability backend is included. Interfaces and local code are not deployed production controls.

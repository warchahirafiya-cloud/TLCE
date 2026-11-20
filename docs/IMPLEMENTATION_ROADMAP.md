# TLCE Implementation Roadmap

## Completed repository and public-web foundation

- [x] Hierarchical parent-platform architecture; QuestPulse is an internal module, not a separate parent application.
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
- [x] Parent browser shell and QuestPulse same-origin internal route integration.
- [x] GitHub Pages workflow that builds and assembles the parent site and QuestPulse web assets.
- [x] Public store catalogue and informational developer programme pages.
- [x] SEO crawl files, canonical/social metadata, structured data and crawlable QuestPulse product fallback.
- [x] Post-deployment smoke-check job configured for the production TLCE origin.
- [x] QuestPulse offer and candidate-inbox validation, including source-host checks, HTTPS URLs, explicit eligibility/disclosures, freshness/expiry checks and candidate-only ingestion.
- [x] PR #33 head passed TLCE CI and QuestPulse Web workflows (runs 44833316213 and 44833316208).

## Remaining work before a production candidate

1. **Production deployment evidence:** confirm a successful Pages deployment and post-deploy smoke-check on the exact current `main` commit and inspect the live public routes.
2. **Legal and public trust:** publish reviewed privacy, terms, contact/support, content-removal and complaint procedures. Confirm the public site does not imply active services that are not implemented.
3. **Durable events:** implement and contract-test a durable idempotency store with atomic claims, leases, crash recovery and retention; add durable broker and dead-letter adapters plus replay/poison-message procedures.
4. **Network egress:** add network-level private-range and cloud-metadata blocking around the existing DNS-aware, IP-pinned outbound HTTP helper.
5. **Execution isolation:** implement signed module artifacts and a hardened process/container isolation boundary before any dynamic module loading.
6. **Production identity and gateway:** implement OIDC/JWT verification, schema validation, shared rate limiting, quotas, tenant isolation and an actual HTTP/edge adapter.
7. **Persistent audit:** implement an append-only audit sink, access controls, encryption, retention and operational alerts.
8. **Operations:** implement configuration schema validation, secret injection, structured telemetry, traces, health/readiness probes, SLOs, backups and incident response.
9. **Supply-chain reproducibility:** commit a dependency lockfile, move CI to `npm ci`, and add SBOM, dependency and secret scans.
10. **QuestPulse source integration:** complete authoritative source inventory, route/schema/business-rule mapping and field-level migration/contract tests. Keep the original `app.asar` read-only.
11. **Store transaction workflows:** if the intended release includes third-party publishing or purchases, implement developer identity/approval, secure uploads, malware/signature checks, moderation, persistent catalogue storage, checkout/payment, refunds and audit trails. Until then, retain the current informational/static scope and do not present these capabilities as live.
12. **Release readiness:** complete integration, threat-model review, abuse-case tests, real-browser E2E, accessibility review, independent security review, staging and rollback rehearsal.

## Release policy

Keep implementation work on feature branches until CI passes on the exact head, source integration is reviewed and security gates pass. Main-branch merges, production deployments, DNS/Pages changes, paid resources, secret provisioning and production data migrations remain gated by explicit approval. A green CI run is not a production-readiness certificate.

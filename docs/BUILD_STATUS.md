# TLCE Build Status

Last reviewed: 2026-11-19
Baseline: `main` at `e68c47371c884fc5a1230c908fb9dc56071bf0ae`

## Implemented and verified foundation

- Hierarchical TLCE parent architecture; QuestPulse remains an internal product module.
- Shared module manifest, dependency, permission, lifecycle, context and health contracts.
- Runtime registry validation, dependency ordering, missing/cycle detection and defensive manifest snapshots.
- Runtime lifecycle start/stop serialization, deny-by-default permission grants, immutable module context, health response validation and failure cleanup.
- API gateway request/path validation, traversal and encoded separator rejection, capability checks, correlation IDs and exception-detail isolation.
- Provider-neutral event envelope and event processing contract.
- Idempotent event processor with bounded retries and a dead-letter sink integration contract.
- Outbound HTTP URL validation with DNS A/AAAA checks, public-address validation, selected-IP pinning, redirect revalidation, HTTPS downgrade rejection, response-size limits and request timeouts.
- LLM7 proxy handler with fail-closed behavior unless server-verified authentication and shared rate limiting are injected; request bounds and provider-response validation.
- Immutable audit record construction with metadata limits and sensitive-key rejection.
- Unit tests for runtime lifecycle, registry integrity, gateway validation, event processing, outbound URL checks, LLM7 request handling and audit records.
- TypeScript strict checking and unit tests pass in GitHub Actions on the current main baseline.
- GitHub Pages deployment succeeded on commit `e68c47371c884fc5a1230c908fb9dc56071bf0ae`; the published HTML, JS, CSS and JSON endpoints returned HTTP 200 in post-deployment inspection.

## Active verification work (not yet merged)

- PR #20 adds a post-deployment smoke-check job for the actual GitHub Pages URL, including the deployed CSP, JS/CSS assets and parsed JSON catalogues.
- PR #21 adds deterministic UI interaction tests for catalogue filtering and guide persistence. Its initial test run caught and corrected an assertion mismatch; the corrected run passed the QuestPulse Web suite and TLCE CI.

These changes are not part of `main` until reviewed and merged.

## Production gaps — explicitly not complete

- Runtime still executes module implementations in-process; no hardened process/container sandbox or signed artifact verification exists.
- Event processing still depends on a durable atomic idempotency store, lease recovery and a durable broker/dead-letter adapter.
- Outbound URL code validates DNS and pins the selected public IP, but there is no network-level egress firewall or cloud metadata isolation policy.
- API gateway remains an in-process router, not a production HTTP server; production OIDC/JWT verification, schema validation, quotas, rate limiting and tenant isolation adapters remain absent.
- LLM7 handler is not mounted at a deployed server route. It intentionally returns 503 unless real authentication and shared rate-limit services are supplied.
- Audit records have a safe constructor but no persistent audit sink, retention policy or access-control adapter.
- No production database, cache, secrets manager, cloud provider adapters, monitoring, DNS or infrastructure provisioning is configured.
- Root dependency installation uses `npm install`; a committed lockfile and reproducible `npm ci` pipeline are still needed.
- QuestPulse legacy routes, schema and business rules have not been source-integrated; the original `app.asar` remains untouched.

## Verification policy

Use the latest GitHub Actions run attached to the exact current branch HEAD as the authoritative CI status. Historical failures on earlier commits are not evidence of failure in the current HEAD. CI success and static Pages availability do not imply production readiness. Do not provision services, migrate production data, alter DNS or enable public backend traffic without explicit approval.


## QuestPulse parent-runtime integration (merge candidate)

- The integration branch now carries the parent browser shell, same-origin QuestPulse frontend mount, route lifecycle, and browser TypeScript build introduced by the QuestPulse runtime integration change.
- The GitHub Pages artifact is assembled with the TLCE parent at the site root and the QuestPulse frontend under `/web/`; runtime assets are emitted under `/runtime/`.
- Runtime/browser validation must pass on this exact merge candidate before the change is eligible for merge into `main`.
- The browser host denies backend and event capabilities by default. No backend, credentials, production data, DNS, paid services, or original `app.asar` reference asset is changed by this integration.
- This frontend/runtime composition does not constitute production sandbox isolation, authentication, backend deployment, or full migration of the legacy QuestPulse implementation.

# TLCE Integration Control Plane

Status: engineering specification and registry foundation; no third-party provider is connected by this document.

## Mission
Provide one governed integration layer for the tools and services nominated by the owner. TLCE remains the parent platform. QuestPulse (Q.P) is an internal module and consumes approved TLCE capabilities; it does not own connector credentials, OAuth flows, provider adapters, or a second integration gateway.

## Architecture
1. **Catalogue** — canonical provider IDs, product families, official origins, supported protocol hints, lifecycle state and capability tags.
2. **Connection broker** — provider-specific OAuth authorization-code/PKCE or documented API-key onboarding. The browser returns only an authorization result; tokens are exchanged server-side.
3. **Secret vault** — stores refresh/access tokens and API keys as encrypted secret references. Never store raw credentials in Git, logs, client storage, issue text or this registry.
4. **Grant service** — tenant + principal + provider + resource + operation scoped grants. Default deny. Read, write, execute, admin and financial actions are distinct.
5. **Provider adapters** — provider SDKs and API details are isolated behind TLCE-owned interfaces. Adapters cannot bypass Core authorization or audit.
6. **Capability router** — exposes reviewed, bounded operations to TLCE modules, MCP clients and future GPT Actions. All paths share the same authorization decision point.
7. **Audit & observability** — metadata-only audit events, correlation IDs, redaction, provider health and connection lifecycle events.

## Connection lifecycle
`catalogued → reviewed → consent_pending → connected → health_checked → enabled`
Failure or revocation transitions to `disconnected` or `revoked`. A catalogue entry is not a connection. A connected account is not automatically enabled for every operation.

## Permission tiers
- `read`: retrieve explicitly authorized resources.
- `write`: create or update content; requires resource-scoped grant.
- `execute`: trigger a workflow or job; requires an explicit operation allowlist.
- `admin`: change provider settings, users, billing or security controls; disabled by default.
- `financial`: payments, transfers, trades, purchases or subscription changes; never enabled by a broad connector grant and always requires a separate owner confirmation at action time.

## Mandatory controls
- OAuth state + PKCE where supported; exact redirect URI allowlists; issuer/audience validation.
- Least privilege, tenant isolation, resource scoping, short-lived access tokens and refresh-token rotation where supported.
- Server-side secret storage, encryption at rest, redaction, rotation and revocation.
- SSRF-safe outbound networking, DNS resolution and redirect revalidation; provider origins are not an SSRF allowlist by themselves.
- Schema validation, bounded payloads, rate limits, retries with idempotency keys and circuit breakers.
- Audit before/after mutating operations; never log credentials or sensitive payload bodies.
- Webhook signature verification, replay protection and event deduplication.
- Dependency pinning, SBOM, vulnerability scans and adapter contract tests.

## Consent and owner controls
The owner may authorize setup and broad operational access, but each provider still requires its own sign-in/consent flow. The platform cannot infer passwords, bypass MFA, accept terms, create paid subscriptions, provision paid cloud resources, or perform payments/trades on the owner's behalf. These steps remain interactive and/or require a separate explicit confirmation.

## Delivery phases
1. Catalogue and classify nominated providers (this branch).
2. Implement typed provider/connection/grant contracts and mock adapter tests.
3. Integrate one low-risk OAuth provider end-to-end, initially read-only.
4. Add secret-vault and durable audit adapters.
5. Add write operations one provider at a time after tests and explicit scope review.
6. Add higher-risk legal, health, financial and advertising connectors only after data classification, jurisdiction, consent and retention review.
7. Staging deployment, threat review, then production approval.

## Current truth
This branch adds documentation and registry scaffolding only. It does not register OAuth clients, create accounts, connect user accounts, store secrets, deploy services or grant access to any third party.

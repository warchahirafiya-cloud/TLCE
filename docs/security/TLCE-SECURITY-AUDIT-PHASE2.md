# TLCE Security Audit — Phase 2 Baseline

Date: 2026-11-23
Reviewed revision: `1ddf3b0ba3e8613e33a5c5ad4a115c5ecde269dc`
Scope: repository source and CI configuration. This is a code/configuration review, not a penetration test, cloud-account inspection, or production certification.

## Executive finding

**The private developer/operator console is not implemented. Do not expose or use a developer console for privileged operations yet.** The repository's architecture decision correctly keeps it out of the public GitHub Pages artifact. The current API gateway is an in-process router for local integration tests, not an internet-facing authentication boundary.

## Evidence-based findings

| Area | Current evidence | Assessment |
|---|---|---|
| Developer console | `docs/PUBLIC_DEVELOPER_INTERFACE_BOUNDARY.md` states it is unimplemented; no console app/API deployment exists in the reviewed tree | **Blocking** — no secure console to log into |
| Central identity / MFA | No identity provider integration, account lifecycle, MFA enrollment/recovery, or session service found in the reviewed application code | **Blocking** — cannot provision privileged developer accounts safely |
| API gateway | `infrastructure/api-gateway/src/router.ts` accepts a `principal` object in an in-process request; its own comment says it is not an internet-facing HTTP server | **High boundary risk if misused** — never expose this router directly or accept client-supplied principals |
| Authorization evaluator | `core/identity/src/authorization.ts` compares exact resource/action grants but previously accepted malformed runtime data and had no explicit wildcard rejection | **Hardening applied in this phase** — malformed records and wildcard identifiers now fail closed |
| Integration Worker | `infrastructure/production-worker/index.ts` verifies Cloudflare Access JWT signature, issuer, audience, expiry and not-before before protected search; rate-limit failures fail closed | **Narrow protection only** — protects `/api/search`, not a developer console or general user identity system |
| Worker deployment | `.github/workflows/deploy-integration-worker.yml` deploys safe mode first; protected search activation depends on Access secrets and a separately configured Cloudflare Access application | **Configuration-dependent** — repository review cannot confirm Cloudflare account-side policy |
| Public hosting | `deploy-pages.yml` publishes static public assets to GitHub Pages | **Expected** — all published files are public; no privileged console or secrets belong there |
| Audit trail | Core audit interfaces exist, but no production durable audit sink/retention controls were found in the reviewed runtime | **Blocking for privileged production actions** |
| Tenant isolation | No complete server-side tenant/account data model and enforcement layer was found in the reviewed console/API surface | **Blocking for multi-developer access** |

## Changes in this phase

- Hardened `isAuthorized` to validate resource/action identifiers and permission arrays at runtime.
- Wildcard grants are rejected; matching remains exact and case-sensitive.
- Added regression tests for wildcard attempts, malformed grants, invalid identifiers and case mismatch.

These changes improve the policy helper only. They do **not** authenticate a caller, establish a trusted principal, provide MFA, create sessions, implement tenant isolation, or make the in-process API gateway safe for public exposure.

## Required order before a developer console can go live

1. Select and configure a central identity provider; define account recovery and MFA policy for privileged roles.
2. Implement server-side session validation and a trusted identity-to-principal adapter. Browser payloads must never create or modify principals.
3. Define roles/capabilities and tenant/resource scoping; deny by default and test cross-tenant access.
4. Deploy a real server-side API boundary with strict schema validation, CSRF controls where cookie sessions are used, rate limits and security headers.
5. Add append-only durable audit events for privileged reads, mutations, approvals and security changes.
6. Keep the console deployment separate from GitHub Pages; add independent security review and operational monitoring.
7. Only after the above, enable developer account onboarding and product submission workflows.

## Explicit non-actions

No production deployment, DNS change, paid service, identity-provider account, Cloudflare Access policy, repository secret, database migration, payment activation, or modification of `app.asar` was performed.

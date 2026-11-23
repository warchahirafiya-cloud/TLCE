# TLCE Project Memory — Security and Release Blockers

**Status:** OPEN — release-blocking  
**Recorded:** 2026-11-23  
**Applies to:** TLCE platform, developer/operator console, API boundary, identity and privileged operations  
**Source baseline:** phase-2 security review at `0d0f93d67eb5335dafc61b8d2172fcf3c04b2e62`

This file is the durable project reference for security and launch gates. These items must remain visible in future planning and reviews. A passing CI run or a merged pull request does not, by itself, close any blocker.

## Release decision

**Do not launch or expose a privileged developer console, developer onboarding, privileged API operations, or production multi-tenant workflows until every applicable blocker below is implemented, tested, and independently verified.**

## Blocking requirements

| ID | Blocker | Required closure evidence |
|---|---|---|
| TLCE-SEC-01 | No private developer/operator console exists. The public developer page is informational only. | A separately deployed, access-controlled console; verify it is not included in the public GitHub Pages artifact. |
| TLCE-SEC-02 | No central identity provider and privileged account lifecycle are implemented. | Approved identity-provider integration, server-side account provisioning/deprovisioning, recovery controls, and documented privileged-role policy. |
| TLCE-SEC-03 | MFA is not implemented for privileged accounts. | MFA enrollment, enforcement for privileged roles, recovery procedure, and tests for bypass/recovery edge cases. |
| TLCE-SEC-04 | No production session-validation boundary or trusted identity-to-principal adapter exists. | Server validates sessions/tokens and derives principals from trusted identity claims; client-supplied principal data is never trusted. |
| TLCE-SEC-05 | API gateway is an in-process router for local integration use, not a public authentication boundary. | Deploy a real server-side API boundary with strict request schemas, authentication, authorization, safe error handling, and security headers. |
| TLCE-SEC-06 | Tenant/account isolation is incomplete. | Server-side tenant scoping on every relevant read/write, with automated cross-tenant denial tests. |
| TLCE-SEC-07 | CSRF protection and session-boundary controls are not established for cookie-based sessions. | Explicit session design; CSRF defenses where cookies are used; secure cookie attributes and origin checks, covered by tests. |
| TLCE-SEC-08 | Rate limiting and abuse controls are not established as a general policy across privileged endpoints. | Endpoint-specific limits, fail-closed behavior, abuse monitoring, and automated tests. |
| TLCE-SEC-09 | Durable production audit logging for privileged operations is missing. | Append-only durable audit events for privileged reads, mutations, approvals, account/security changes; retention and access policy. |
| TLCE-SEC-10 | Cloudflare Access protection is narrow and configuration-dependent; repository code cannot verify account-side policy. | Verify deployed Access application, issuer/audience, policy, secrets configuration, and protected endpoint behavior in the actual Cloudflare account without exposing secrets. |
| TLCE-SEC-11 | No complete security verification/operational monitoring gate exists for the future console/API surface. | Independent security review, negative authorization tests, monitoring/alerting, and documented incident response before release. |

## Existing narrow hardening — not a closure of the blockers

The authorization helper now validates permission identifiers and arrays at runtime, rejects wildcard grants, and denies malformed records by default. Regression tests cover malformed grants, wildcard attempts, invalid identifiers, and case mismatch.

This helper does **not** authenticate callers, create trusted principals, implement MFA or sessions, enforce tenant isolation, provide durable audit logging, or turn the local API router into a public API boundary.

The Integration Worker’s Cloudflare Access JWT checks protect a limited search path only. They must not be treated as a complete identity or developer-console solution.

## Mandatory implementation order

1. Select the identity provider and approve privileged-account, MFA, and recovery policies.
2. Implement server-side session validation and trusted principal derivation.
3. Define role/capability and tenant/resource authorization rules; deny by default.
4. Build and deploy the real protected API boundary; add schema validation, CSRF controls as applicable, rate limits, and security headers.
5. Implement tenant isolation and negative cross-tenant tests.
6. Add append-only durable audit logging and retention/access controls.
7. Build the private developer console separately from public static hosting.
8. Verify Cloudflare Access and production configuration in the actual provider account.
9. Complete independent security review, monitoring, incident response, and release sign-off.

## Change-control rules

- Do not publish secrets, tokens, credentials, or private identity configuration in the repository.
- Do not enable paid services, create provider accounts, change DNS, alter production settings, or activate payments without explicit owner approval.
- Do not deploy the console or privileged endpoints to public hosting.
- Do not mark a blocker closed based only on implementation claims or green CI. Record the code change, tests, deployment/configuration evidence where applicable, and reviewer sign-off.
- Keep `app.asar` as a separate reference artifact; do not modify or merge it without explicit approval.
- Keep this file updated whenever a blocker is split, mitigated, verified, or formally waived. A waiver must identify the approver, scope, rationale, and expiry.

## Current state

All TLCE-SEC-01 through TLCE-SEC-11 remain **OPEN** as of this record, except for the narrow authorization-helper hardening described above, which is a mitigation and not closure of any end-to-end blocker.

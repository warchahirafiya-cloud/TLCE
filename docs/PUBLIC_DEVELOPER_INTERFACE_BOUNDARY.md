# TLCE Public and Developer Interface Boundary

Status: approved architecture boundary; implementation is staged.

## Decision

TLCE exposes two distinct experiences under one parent platform:

1. **Public user experience** — the public website and product-module interfaces intended for visitors and end users. The current GitHub Pages deployment of `apps/web` is a static public surface.
2. **Private developer / operator console** — a separate, authenticated control plane for maintainers and authorized operators. It is not part of the public GitHub Pages bundle.

QuestPulse remains an internal product module of The Last Cosmic Explosion (TLCE). This separation does not create a second parent application or a standalone Q.P product.

## Current verified state

- `apps/web/index.html` is a public Arabic QuestPulse catalogue interface.
- `.github/workflows/deploy-pages.yml` uploads `apps/web` directly as a GitHub Pages artifact.
- The deployed static site must therefore be treated as publicly readable. Hiding links or buttons in browser JavaScript is not access control.
- The current public interface loads public catalogue data from `apps/web/data/offers.json`.
- No authenticated developer console or server-side authorization boundary is established by the static Pages deployment.

## Public website rules

The public surface may contain:
- public product information and published offers;
- public documentation and support links;
- read-only data explicitly approved for public release.

It must not contain:
- admin or operator routes that rely only on client-side hiding;
- API credentials, signing keys, private tokens, session secrets, or privileged configuration;
- write-capable administrative endpoints without server-side authorization;
- internal logs, user records, moderation queues, private analytics, or unpublished offers.

All public data must be considered downloadable by any visitor. Do not place confidential information in the repository's public web directory or its generated artifact.

## Private developer console target

The private console is a TLCE control-plane capability, not a page protected by a JavaScript password prompt.

Required controls before implementation or exposure:
- central TLCE Identity authentication; no separate QuestPulse password store;
- server-side authorization on every request, deny by default;
- role/capability-based access with least privilege (for example: viewer, operator, maintainer, security administrator);
- MFA for privileged accounts;
- short-lived sessions, secure HttpOnly/SameSite cookies, CSRF protection where cookie authentication is used;
- audit events for privileged reads and all mutations;
- rate limits, input validation, and security monitoring;
- secrets injected only into server runtime through an approved secret manager;
- no privileged credentials or authorization decisions in client-side code;
- explicit environment separation for development, staging, and production.

The console must call authenticated TLCE Core APIs. Product modules must not bypass Core authorization or access another module's database directly.

## Deployment boundary

- GitHub Pages remains a public static hosting target for `apps/web`.
- The private console must not be added to `apps/web` or the Pages artifact.
- A future console must be deployed to an authenticated server-side environment with a protected API gateway and central identity integration.
- Do not create DNS records, purchase hosting, provision paid services, add production secrets, or perform production migrations without separate explicit approval.
- Do not claim the console is secure until server-side authorization and security tests are implemented and verified.

## Delivery sequence

1. Keep the existing public QuestPulse shell user-facing and free of admin controls.
2. Define the developer-console module contract and permission matrix in TLCE Core.
3. Implement the console UI in a separate internal app/package, excluded from public Pages artifacts.
4. Implement server-side identity, authorization, audit, and API gateway enforcement.
5. Add automated authorization tests, including anonymous access, role escalation, cross-module access, CSRF, and session expiry.
6. Review the security boundary and deployment configuration before enabling any operator access.

## Current decision

The public site and private console are separate interfaces within the same TLCE platform. The public site remains accessible; the developer console remains unimplemented and unavailable until its server-side security boundary exists.

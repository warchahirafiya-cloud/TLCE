# QuestPulse Integration Contract

**Status:** Internal module and micro-frontend host adapter implemented on `feature/questpulse-host-registry-integration`; full product UI and legacy workflow migration remain pending.

## Product boundary
QuestPulse (Q.P) is an internal TLCE product branch. It must not become a second parent application, own a separate user identity provider, or deploy a duplicate copy of the TLCE Runtime Engine.

TLCE owns the shell, branch registry, module lifecycle, identity, authorization, shared social engine, notifications, audit policy, and platform configuration. Q.P owns only branch-specific rewards/offer workflows and UI.

## Implemented host integration
- `modules/questpulse/src/manifest.ts` declares the Q.P module identity and currently requests no permissions.
- `modules/questpulse/src/index.ts` implements the shared module lifecycle contract.
- `modules/questpulse/src/micro-frontend-manifest.ts` declares the `/questpulse` route and UI contract.
- `modules/questpulse/src/micro-frontend.ts` provides a minimal accessible in-process mount adapter.
- `runtime/engine/src/product-branch-registry.ts` coordinates the module and micro-frontend registries, checking ID/version/API consistency and duplicate route ownership.
- `modules/register-built-in-branches.ts` is the single built-in branch registration point.
- `runtime/engine/src/questpulse-host.ts` composes the parent registries, RuntimeEngine, and MicroFrontendHost. It starts the module before mount and tears it down on unmount or mount failure.
- The loader is a static allowlist. No arbitrary URL, remote import, or untrusted bundle is loaded.

The static TLCE browser shell now routes `#/questpulse` into the parent host through `apps/web/public/branch-host.js`. The `build:web` script compiles the host adapter into same-origin assets. A deployment process must run `npm run build:web` before publishing. The Q.P UI surface remains a mount-contract placeholder, not the complete website.

See [Branch Registry and QuestPulse Host Integration](BRANCH_REGISTRY_AND_QUESTPULSE_HOST.md) for the source map, behavior, tests, and release gates.

## Capability and identity policy
Q.P currently requests zero capabilities. Parent-owned service calls and events are denied unless future capabilities are explicitly declared, reviewed, and granted by TLCE authorization. Q.P must not create local users, passwords, or sessions as a second authority. Legacy Q.P user/session data is not migrated by this change.

## Known legacy reference surface
The QuestPulse repository contains a Node.js/Express + SQLite API prototype with user, session, post, and media data areas. These are a discovery baseline, not approval to preserve the schema or copy it unchanged. The original `app.asar` and source artifacts remain protected and are not modified by this integration.

## Target ownership and migration rules

| Legacy area | TLCE target | Integration rule |
| --- | --- | --- |
| users | TLCE Identity | Map approved publisher/user identifiers to central identities; do not import a second password store or account lifecycle. |
| sessions | TLCE Identity / session service | Do not migrate or duplicate legacy sessions. |
| posts | TLCE Content Registry + Q.P domain | Map approved publications to parent canonical content IDs and keep Q.P-specific offer fields in the branch domain. |
| media | TLCE Media | Reconcile ownership, access, retention, malware scanning, and storage before migration. |
| likes/comments/shares | TLCE Social Engine | Use the single parent-owned social engine. |
| notifications | TLCE Notifications | Consume parent events/service; do not create a Q.P notification system. |
| Q.P business rules | modules/questpulse | Keep branch-specific workflows here and call versioned Core contracts. |

All data mappings require source-level field review and migration tests before any data movement.

## Security constraints
- Deny access unless the central authorization layer grants the exact capability.
- Validate all external input at the module boundary.
- Treat URLs, uploaded media, and third-party callbacks as untrusted.
- Prevent SSRF with DNS-aware egress controls, redirect revalidation, and network-level private-range blocking before enabling external fetching.
- Never log credentials, access tokens, session cookies, private keys, or sensitive payloads.
- Apply rate limits, audit trails, and abuse controls to externally reachable actions.
- Do not load untrusted remote module code until signed artifacts and hardened process/container isolation exist.

## Integration gates
1. [x] Identify the TLCE parent repository and inspect its runtime/registry contracts.
2. [x] Add the Q.P module manifest and lifecycle adapter.
3. [x] Register Q.P in the parent module and micro-frontend registries.
4. [x] Add host composition and lifecycle tests.
5. [ ] Confirm CI typecheck, browser bundle build, and full test suite on this integration branch.
6. [ ] Ensure the eventual static-shell deployment runs `npm run build:web`; no deployment was performed here.
7. [ ] Review the authoritative Q.P source and map its routes, tables, auth, media, and workflows.
8. [ ] Migrate the full Q.P UI and business workflows behind parent contracts; no second identity/session or social store.
9. [ ] Add end-to-end, accessibility, authorization, abuse-case, and migration dry-run tests.
10. [ ] Obtain explicit approval before merge, deployment, production data migration, DNS changes, paid services, or secret provisioning.

## Current decision
The Q.P branch is registered in TLCE's in-process module and micro-frontend host foundations. This does not establish a production deployment, dynamic remote loading, active identity provider, connected database, or full Q.P UI migration. The legacy source and original `app.asar` remain unchanged.

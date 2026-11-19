# QuestPulse Integration Contract

Status: source discovery completed; runtime integration remains in progress.

## Product boundary

QuestPulse (Q.P) is an internal TLCE product module. It must not become a second parent application, own a separate user identity provider, or deploy a duplicate copy of the TLCE Runtime Engine.

The current TLCE static web shell is under `apps/web/`. The module boundary and host are under `modules/questpulse/` and `runtime/engine/src/questpulse-host.ts`.

## Authoritative source locations

- Parent platform: `warchahirafiya-cloud/TLCE`.
- Current TLCE-hosted Q.P web shell: `apps/web/index.html`, `apps/web/questpulse.js`, `apps/web/questpulse-catalogue.mjs`, `apps/web/styles.css`, and `apps/web/data/`.
- Internal module boundary: `modules/questpulse/README.md`.
- Runtime host: `runtime/engine/src/questpulse-host.ts`.
- Earlier Q.P project/source repository: `warchahirafiya-cloud/QuestPulse`, default branch `main`. It contains a separate static website and a Node.js/Express + SQLite API prototype. Use it as a reference for selective migration, not as a second parent application.

The original `app.asar` reference remains protected. Do not modify it or infer undocumented business rules from it.

## Current implementation boundary

The TLCE web shell is a static Arabic RTL page deployed through GitHub Pages. It loads the public offers and knowledge-centre JSON files and stores saved guides locally in the visitor's browser. It does not provide account login, publisher submission, shared uploads, moderation, social actions, payment handling, or cross-device persistence.

The runtime host currently registers a Q.P manifest and lifecycle stub, then creates a placeholder DOM section. It does not yet load or mount the `apps/web` application. Completing this mount is a distinct integration milestone.

The separate Q.P repository contains a prototype publisher API with local `users`, `sessions`, `posts`, and `media` tables. It is not a deployed parent service. Do not copy its user/session tables into TLCE or treat its local SQLite database as canonical.

## Target ownership and migration rules

| Q.P source concept | TLCE target | Integration rule |
| --- | --- | --- |
| Publisher identity/profile | TLCE Identity | Map actors to central identities. Retain only approved publisher profile metadata. |
| Local sessions and `qp_session` | TLCE Identity/session layer | Do not migrate sessions or keep a second login authority. |
| Q.P offers/posts | TLCE Content Registry + Q.P domain extension | Map accepted records to canonical TLCE content IDs and retain Q.P-specific fields in the module domain. |
| Local uploads/media | TLCE Media | Move behind parent media contracts, storage policy, access controls, retention, and scanning. |
| Admin review | TLCE Authorization + Moderation | Use parent roles, branch/object scope, reason codes, and immutable audit history. |
| Likes/comments/shares/reports | TLCE Social Engine | Implement once in parent core; Q.P consumes parent contracts. |
| Notifications | TLCE Notifications | Consume parent events; do not add a separate Q.P notification service. |

All mappings require source-level field review and migration tests before data movement.

## Product scope guard

The current TLCE web shell and the standalone Q.P README state that the active Q.P site excludes cryptocurrency, blockchain, tokens, mining, and wallet features. Historical crypto material is archived in the standalone repository. Preserve this active scope unless a separate product decision explicitly changes it.

## Module integration requirements

A production Q.P module must provide:
- a stable module manifest and semantic version;
- declared API/event contract versions;
- least-privilege permission requests;
- configuration validation with secrets injected only at runtime;
- initialize/start/health/stop lifecycle behavior;
- structured audit events for security-sensitive actions;
- explicit data ownership and retention policy;
- idempotent event handling where delivery is at-least-once.

The module must not access another module's database directly. Cross-module communication uses approved TLCE Core APIs or versioned events.

## Security constraints

- Deny access unless the central authorization layer grants the exact capability.
- Validate all external input at the module boundary.
- Treat URLs, uploaded media, and third-party callbacks as untrusted input.
- Prevent SSRF by blocking loopback, private, link-local, metadata, and non-HTTP(S) destinations; revalidate DNS resolution and redirects at connection time.
- Never log credentials, access tokens, session cookies, private keys, or sensitive payloads.
- Apply rate limits, audit trails, and abuse controls to externally reachable actions.
- Do not load untrusted module code until a hardened isolation model is implemented.

## Integration gates

1. Mount `apps/web` through the Q.P runtime host and add route/lifecycle/browser tests.
2. Inventory the standalone Q.P API routes, database tables, migrations, authentication flows, external integrations, and secrets usage.
3. Produce a field-level mapping and compatibility plan against real TLCE Core contracts.
4. Implement the module adapter on a feature branch with no destructive data migration.
5. Add contract, authorization, abuse-case, and migration dry-run tests.
6. Run security review and maintainer review.
7. Obtain explicit approval before any production data migration, backend deployment, DNS change, paid service, or secret provisioning.

## Current decision

Source discovery is complete. The static Q.P shell is deployed on TLCE Pages, but runtime mounting and parent-owned backend integration remain incomplete. The separate Q.P repository is identified and available for selective source review. No runtime code, production data, deployment settings, domain records, or protected `app.asar` assets were changed by this discovery.

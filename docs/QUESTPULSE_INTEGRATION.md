# QuestPulse Integration Contract

Status: runtime host and browser application router implemented on `fix/questpulse-host-lifecycle`; live parent-shell browser validation and backend integration remain pending.

## Product boundary

QuestPulse (Q.P) is an internal TLCE product module. It must not become a second parent application, own a separate user identity provider, or deploy a duplicate copy of the TLCE Runtime Engine.

The module is registered and operated by the TLCE Runtime Engine. Shared identity, authorization, social capabilities, notifications, audit policy, and platform configuration remain owned by TLCE Core services.

## Verified source locations

- Parent platform: `warchahirafiya-cloud/TLCE`.
- Current TLCE-hosted Q.P web shell: `apps/web/index.html`, `apps/web/bootstrap.js`, `apps/web/questpulse.js`, `apps/web/questpulse-catalogue.mjs`, `apps/web/styles.css`, `apps/web/styles.runtime.css`, and `apps/web/data/`.
- Internal module boundary: `modules/questpulse/README.md`.
- Runtime host: `runtime/engine/src/questpulse-host.ts`.
- Earlier Q.P project/source repository: `warchahirafiya-cloud/QuestPulse`, default branch `main`. It contains a separate static website and a Node.js/Express + SQLite API prototype. Use it as a reference for selective migration, not as a second parent application.

The original `app.asar` reference remains protected. Do not modify it or infer undocumented business rules from it.

## Runtime frontend mount

The runtime host now:
- validates the Q.P route namespace;
- fetches the existing static Q.P HTML from a configured same-origin base URL;
- imports body content without executing embedded script elements;
- mounts the page in a Shadow DOM boundary to prevent the Q.P stylesheet from leaking into TLCE parent UI;
- dynamically imports the exported `mountQuestPulse(root)` lifecycle;
- tears down event listeners and pending fetches on unmount;
- stops the runtime module if frontend mounting fails.

The standalone static page uses `apps/web/bootstrap.js` to call the same mount lifecycle. The runtime host accepts `frontendBaseUrl`: use `/apps/web/` when serving the repository root, or `/` when the contents of `apps/web/` are deployed at the site root. The default is `/apps/web/` for repository-root development.

Host tests cover route rejection, duplicate mount, teardown, and runtime rollback. Browser tests verify the standalone bootstrap and Shadow DOM-scoped stylesheet.

This is a frontend integration milestone, not a deployed runtime route. The existing GitHub Pages static deployment is a separate artifact and has not been replaced by this host implementation.

## Current frontend behavior

The shell remains a static Arabic RTL, public read-only interface. It loads public offers and knowledge-centre JSON files and stores saved guides locally in the visitor's browser. It does not provide account login, publisher submission, shared uploads, moderation, social actions, payment handling, or cross-device persistence.

## Legacy API reference

The separate Q.P repository contains a prototype publisher API with local `users`, `sessions`, `posts`, and `media` tables. It uses local SQLite and local-disk media storage. It is not a deployed parent service and is not integrated into TLCE.

Do not copy its user/session tables into TLCE or treat its local SQLite database as canonical. Its post and media records must be mapped to parent-owned content/media contracts before migration.

## Target ownership and migration rules

| Legacy area | TLCE target | Integration rule |
| --- | --- | --- |
| Publisher identity/profile | TLCE Identity | Map actors to central identities. Retain only approved publisher profile metadata. |
| Local sessions | TLCE Identity/session layer | Do not migrate sessions or keep a second login authority. |
| Q.P offers/posts | TLCE Content Registry + Q.P domain extension | Map accepted records to canonical TLCE content IDs and retain Q.P-specific fields in the module domain. |
| Local uploads/media | TLCE Media | Move behind parent media contracts, storage policy, access controls, retention, and scanning. |
| Admin review | TLCE Authorization + Moderation | Use parent roles, object scope, reason codes, and immutable audit history. |
| Likes/comments/shares/reports | TLCE Social Engine | Implement once in parent core; Q.P consumes parent contracts. |
| Notifications | TLCE Notifications | Consume parent events; do not add a separate Q.P notification service. |

All mappings require source-level field review and migration tests before data movement.

## Product scope guard

The current TLCE web shell and standalone Q.P README state that the active Q.P site excludes cryptocurrency, blockchain, tokens, mining, and wallet features. Historical crypto material is archived in the standalone repository. Preserve this active scope unless a separate product decision explicitly changes it.

## Security constraints

- Deny access unless the central authorization layer grants the exact capability.
- Validate all external input at the module boundary.
- Treat URLs, uploaded media, and third-party callbacks as untrusted input.
- Prevent SSRF by blocking loopback, private, link-local, metadata, and non-HTTP(S) destinations; revalidate DNS resolution and redirects at connection time.
- Never log credentials, access tokens, session cookies, private keys, or sensitive payloads.
- Apply rate limits, audit trails, and abuse controls to externally reachable actions.
- Do not load untrusted module code until a hardened isolation model is implemented.
- The runtime frontend URL is same-origin only; do not accept it from user-controlled data. The application router also rejects cross-origin navigation.

## Remaining integration gates

1. Embed `createTLCEApplicationRouter` in the parent browser shell, provide its root element and host instance, then verify route behavior in a real browser. The reusable router and lifecycle tests now exist; the repository still has no parent HTML shell/composition page.
2. Inventory the standalone Q.P API routes, database tables, migrations, authentication flows, external integrations, and secrets usage.
3. Produce field-level mappings against actual TLCE Core identity/content/media contracts.
4. Implement parent-owned identity, content, media, moderation, and audit adapters on a feature branch.
5. Add contract, authorization, abuse-case, and migration dry-run tests.
6. Run security review, accessibility/mobile review, and maintainer review.
7. Obtain explicit approval before production data migration, backend deployment, DNS change, paid service, or secret provisioning.

## Current decision

The Q.P source repository is identified and the existing web shell now has a runtime mount lifecycle on the development branch. The legacy API and identity model remain unintegrated. No production data, DNS records, paid services, or protected `app.asar` assets were changed.

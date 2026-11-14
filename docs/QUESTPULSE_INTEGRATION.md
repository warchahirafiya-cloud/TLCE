# QuestPulse Integration Contract

Status: design baseline; implementation pending source review.

## Product boundary
QuestPulse (Q.P) is an internal TLCE product module. It must not become a second parent application, own a separate user identity provider, or deploy a duplicate copy of the TLCE Runtime Engine.

The module is registered and operated by the TLCE Runtime Engine. Shared identity, authorization, social capabilities, notifications, audit policy, and platform configuration remain owned by TLCE Core services.

## Known legacy reference surface
The previously reviewed Q.P technical reference contains an experimental Node.js/Express + SQLite API with the following data areas:
- users
- sessions
- posts
- media

This list is a discovery baseline, not approval to preserve the legacy schema or copy its implementation. The original app.asar and source artifacts remain protected and must not be modified as part of this integration.

## Target ownership and migration rules

| Legacy area | TLCE target | Integration rule |
| --- | --- | --- |
| users | TLCE Identity | Map stable publisher/user identifiers to central identities. Do not import a second password store or account lifecycle. |
| sessions | TLCE Identity / session service | Do not migrate or duplicate legacy sessions. Re-authenticate through the central identity boundary. |
| posts | TLCE shared Social Engine | Map authorship to central identity and branch/module ownership to Q.P. Do not create a second social graph or feed engine. |
| media | TLCE media/storage capability | Reconcile ownership, access policy, retention, and malware/content scanning before any migration. |
| Q.P business rules | modules/questpulse | Keep branch-specific workflows here and call versioned Core contracts. |

All mappings require source-level field review and explicit migration tests before data movement.

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
1. Identify and review the authoritative Q.P source repository and current entrypoints.
2. Inventory routes, database tables, migrations, authentication flows, external integrations, and secrets usage.
3. Produce a field-level mapping and compatibility plan against TLCE Core contracts.
4. Implement the module adapter on a feature branch with no destructive data migration.
5. Add contract, authorization, abuse-case, and migration dry-run tests.
6. Run security review and maintainer review.
7. Obtain explicit approval before any production data migration, deployment, DNS change, paid service, or secret provisioning.

## Current decision
The TLCE repository currently contains the Q.P module boundary and this integration contract only. The legacy Q.P implementation has not been copied, executed, deployed, or modified. Real integration remains blocked until its authoritative source tree and dependencies are available for review.

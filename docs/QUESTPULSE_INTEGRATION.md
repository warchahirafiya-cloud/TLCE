# QuestPulse Integration Status

Status: host foundation implemented on `integration/questpulse-host-v1`; validation and source migration remain pending.

## Product boundary
QuestPulse (Q.P) is an internal TLCE product module. It does not become a second parent application, own a separate identity provider, or deploy a duplicate Runtime Engine.

TLCE owns the application shell, runtime, module and route registries, identity, authorization, audit policy, and shared services. Q.P owns its domain workflows and UI adapter.

## Implemented in this branch
- Shared micro-frontend contracts for manifests, host context, scoped services, mount options, and lifecycle.
- Manifest validation, duplicate checks, route namespace resolution, dependency ordering, and defensive snapshots.
- Capability-gated API and event facade with method, path, and event namespace validation.
- Parent-owned product branch registry that preflights module and frontend manifests before registration.
- Single built-in branch registration point for QuestPulse.
- Statically allowlisted, in-process Q.P adapter and host composition root.
- Route safety, duplicate registration, capability denial, mount/unmount, request validation, and concurrent mount tests.

## Explicit limits
The current adapter is a minimal accessible host surface, not the full QuestPulse product UI. It does not load a remote bundle or fetch the manifest entrypoint. Q.P currently requests zero capabilities in its production manifest; service calls therefore remain denied.

The separate QuestPulse repository has not been copied into this branch. The original `app.asar` remains an independent protected technical reference and has not been modified.

## Legacy migration rules
- Map legacy users to TLCE Identity; do not import a second password store.
- Re-authenticate through TLCE sessions; do not migrate legacy sessions.
- Map posts and authorship to TLCE shared social contracts.
- Review media ownership, authorization, retention, and scanning before migration.
- Keep Q.P-specific workflows inside `modules/questpulse` and use versioned TLCE Core APIs/events.

## Validation gates
1. Run typecheck, browser build, and the complete test suite on this integration branch.
2. Review route safety, capability policy, lifecycle rollback, and concurrent mount behavior.
3. Inspect the authoritative QuestPulse repository source, routes, schemas, authentication, media, and integrations.
4. Produce field-level mappings and migration dry-run tests before any data movement.
5. Migrate the real Q.P UI only after source and asset review.
6. Approve each required capability explicitly and test authorization boundaries.
7. Obtain separate approval before merge, deployment, production data migration, DNS changes, paid infrastructure, or secret provisioning.

## Current decision
The host foundation is isolated on an integration branch. It is not yet a production-ready QuestPulse deployment. No production service, external API, database, or user data was connected or migrated.

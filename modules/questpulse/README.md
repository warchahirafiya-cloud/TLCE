# QuestPulse (Q.P) — Internal TLCE Module

QuestPulse is an internal product module of The Last Cosmic Explosion (TLCE), not a separate parent application.

## Ownership
- TLCE owns the shell, Runtime Engine, identity, authorization, audit, shared APIs, and module lifecycle.
- Q.P owns only its domain-specific UI and offer/publisher workflows.
- Q.P must not create a second identity provider, session store, social graph, media service, or Runtime Engine.
- Cross-module communication uses approved TLCE APIs and versioned events, never direct database access.

## Current integration state
The `integration/questpulse-host-v1` branch contains a manifest, module lifecycle adapter, micro-frontend contract, route registry, capability-scoped host, and minimal accessible UI adapter.

The adapter proves the parent-host boundary only. It is not the full QuestPulse website or its business workflows. The manifest requests zero capabilities until each required capability is reviewed and approved.

The authoritative QuestPulse repository remains a separate technical source for review. No legacy source or user data has been copied. The original `app.asar` remains protected and unchanged.

## Next gates
Run the full CI suite on the integration branch, inspect the authoritative Q.P source and dependencies, map legacy identity/session/posts/media to TLCE-owned services, and migrate the real UI only after review. Production migration, deployment, DNS, paid services, and secrets require separate approval.

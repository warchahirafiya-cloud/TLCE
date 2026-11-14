# QuestPulse (Q.P) — Internal TLCE Module

QuestPulse is an internal product module of **The Last Cosmic Explosion (TLCE)**. It is not a separate parent application and must not own or duplicate the shared Runtime Engine.

## Current scaffold

- `src/manifest.ts` declares the internal module identity and API contract.
- `src/questpulse-module.ts` implements the shared TLCE lifecycle interface.
- `test/questpulse-module.test.ts` verifies registration, lifecycle and fail-closed permission behavior.
- The manifest currently requests **zero permissions**. Do not grant capabilities until each Q.P feature has been reviewed and mapped to a least-privilege resource/action.
- The module is registered and operated by the shared TLCE Runtime Engine.

## Integration rules

- Register through the TLCE module manifest and Runtime Engine contracts.
- Do not import implementation details from other product modules.
- Keep module-specific data and business logic inside this directory.
- Use versioned TLCE Core APIs and shared event contracts.
- Do not copy the independent Runtime Engine into this module.

## Source provenance and current limitations

The existing QuestPulse repository and original `app.asar` remain separate technical references. This scaffold does not extract, copy, modify, or claim to implement legacy routes, schemas, or business rules. Source integration must follow a separate review and mapping step, with regression tests for every migrated behavior.

The current module is an integration boundary, not a feature-complete QuestPulse release.

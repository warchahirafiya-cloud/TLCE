# QuestPulse (Q.P) — Internal TLCE Module

QuestPulse is an internal product module of **The Last Cosmic Explosion (TLCE)**. It is not a separate parent application and must not own or duplicate the shared Runtime Engine.

## Current scaffold

- `src/manifest.ts` declares the internal module identity and API contract.
- `src/questpulse-module.ts` implements the shared TLCE lifecycle interface.
- `test/questpulse-module.test.ts` verifies registration, lifecycle and fail-closed permission behavior.
- `src/domain.ts` contains the initial opportunity data contract, structural validation and local URL-structure scanner.
- `web/` contains the responsive Smart PWA shell, web app manifest, install-prompt handling and a tightly allowlisted offline app-shell service worker.
- `test/pwa.test.ts` checks PWA manifest, cache-boundary and prototype-claim contracts.
- The manifest currently requests **zero permissions**. Do not grant capabilities until each Q.P feature has been reviewed and mapped to a least-privilege resource/action.
- The module is registered and operated by the shared TLCE Runtime Engine.

## Smart PWA entry

The static web entry is `web/index.html`. Serve the contents of `web/` over HTTPS (or localhost for development). The service worker scope is deliberately limited to the `web/` directory and does not control the TLCE parent application. See [Smart PWA architecture, activation and validation](../../docs/QUESTPULSE_PWA.md).

The PWA shell is a presentation foundation only. It is not yet wired to live opportunity data, authentication or the parent production hosting entry point. Offline support caches only the static shell; it does not cache API responses or user data.

## Integration rules

- Register through the TLCE module manifest and Runtime Engine contracts.
- Do not import implementation details from other product modules.
- Keep module-specific data and business logic inside this directory.
- Use versioned TLCE Core APIs and shared event contracts.
- Do not copy the independent Runtime Engine into this module.
- Keep PWA assets under the module's own web directory until the parent hosting integration is explicitly designed.
- Do not broaden service-worker scope or add API/user-data caching without a security review.

## Source provenance and current limitations

The existing QuestPulse repository and original `app.asar` remain separate technical references. This scaffold does not extract, copy, modify, or claim to implement legacy routes, schemas, or business rules. Source integration must follow a separate review and mapping step, with regression tests for every migrated behavior.

The current module is an integration boundary and PWA foundation, not a feature-complete QuestPulse release.

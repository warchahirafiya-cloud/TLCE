# QuestPulse (Q.P) — Internal TLCE Module

QuestPulse is an internal product module of The Last Cosmic Explosion (TLCE). It is not a separate parent application and must not own or duplicate the shared Runtime Engine.

## Host registration

The TLCE composition root calls `registerQuestPulse(registry)` from `src/register.ts`. This adds the Q.P manifest and implementation to the host `ModuleRegistry`. The host `RuntimeEngine` remains responsible for permission policy, initialization, startup, health checks and shutdown.

Minimal host-side integration:

```ts
import { ModuleRegistry } from "../../runtime/engine/src/module-registry.js";
import { RuntimeEngine } from "../../runtime/engine/src/runtime-engine.js";
import { registerQuestPulse } from "./modules/questpulse/src/register.js";

const registry = new ModuleRegistry();
registerQuestPulse(registry);
const runtime = new RuntimeEngine(registry);
await runtime.startModule("questpulse");
```

Do not create a second Runtime Engine inside QuestPulse. The example shows composition wiring only; it is not yet connected to a production server bootstrap.

## Integration rules

- Register through the TLCE module manifest and Runtime Engine contracts.
- Request only permissions required for documented features. Current requested permissions are intentionally empty.
- Do not import implementation details from other product modules.
- Keep module-specific data and business logic inside this directory.
- Use versioned TLCE Core APIs and shared event contracts.
- Identity, sessions, authorization and shared social capabilities remain owned by TLCE Core.
- Do not access another module's database directly.

## Current implementation boundary

The manifest, lifecycle implementation, host registry adapter and registry/runtime integration tests are present. Product capabilities, persistence, social integration, publisher workflows, reward logic, external providers and production bootstrap registration are not yet implemented.

The existing QuestPulse repository remains a separate technical reference until its code is deliberately reviewed and integrated. No Q.P legacy source or original `app.asar` has been copied, changed, executed or deployed.

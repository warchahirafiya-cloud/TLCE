import type { ModuleRegistry } from "../../../runtime/engine/src/module-registry.js";
import { questPulseManifest } from "./manifest.js";
import { QuestPulseModule } from "./index.js";

/** Registers Q.P as a child module; the parent RuntimeEngine owns its lifecycle. */
export function registerQuestPulseModule(registry: ModuleRegistry): void {
  registry.register(questPulseManifest, new QuestPulseModule());
}

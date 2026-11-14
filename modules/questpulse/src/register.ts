import type { ModuleRegistry } from "../../../runtime/engine/src/module-registry.js";
import { questPulseManifest } from "./manifest.js";
import { QuestPulseModule } from "./index.js";

/**
 * Composition-root adapter: registers Q.P with the host TLCE registry.
 * The host Runtime Engine remains the sole owner of module lifecycle execution.
 */
export function registerQuestPulse(registry: ModuleRegistry): void {
  registry.register(questPulseManifest, new QuestPulseModule());
}

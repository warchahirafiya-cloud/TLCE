import type { MicroFrontendRegistry } from "../../../runtime/engine/src/micro-frontend-registry.js";
import { questPulseMicroFrontendManifest } from "./micro-frontend-manifest.js";

/** Registers the namespaced Q.P route in the parent-owned route registry. */
export function registerQuestPulseMicroFrontend(registry: MicroFrontendRegistry): void {
  registry.register(questPulseMicroFrontendManifest);
}

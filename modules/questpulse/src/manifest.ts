import type { ModuleManifest } from "../../../packages/contracts/src/module.js";

/**
 * QuestPulse is an internal TLCE product branch.
 * Permissions remain empty until each parent capability is approved and wired.
 */
export const questPulseManifest: ModuleManifest = {
  id: "questpulse",
  displayName: "QuestPulse",
  version: "0.1.0",
  description: "Internal rewards and offers branch hosted by The Last Cosmic Explosion.",
  apiVersion: "1",
  entrypoint: "modules/questpulse/src/index.ts",
  dependencies: [],
  requestedPermissions: [],
};

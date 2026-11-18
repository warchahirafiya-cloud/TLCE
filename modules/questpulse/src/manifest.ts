import type { ModuleManifest } from "../../../packages/contracts/src/module.js";

/** Q.P is an internal TLCE product branch; permissions remain empty until approved. */
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

import type { ModuleManifest } from "../../../packages/contracts/src/module.js";

/**
 * QuestPulse is an internal TLCE product module.
 * Keep permissions empty until each capability has an approved Core contract.
 */
export const questPulseManifest: ModuleManifest = {
  id: "questpulse",
  displayName: "QuestPulse",
  version: "0.1.0",
  description: "Internal QuestPulse product module hosted by The Last Cosmic Explosion.",
  apiVersion: "1",
  entrypoint: "modules/questpulse/src/index.ts",
  dependencies: [],
  requestedPermissions: [],
};

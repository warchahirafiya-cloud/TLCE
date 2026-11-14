import type { ModuleManifest } from "../../../packages/contracts/src/module.js";

/**
 * QuestPulse is registered as an internal TLCE module.
 * No legacy app.asar routes, schemas, or business rules are claimed as integrated.
 */
export const questPulseManifest: ModuleManifest = {
  id: "questpulse",
  displayName: "QuestPulse",
  version: "0.1.0",
  description: "Internal QuestPulse module boundary for The Last Cosmic Explosion.",
  apiVersion: "1.0.0",
  entrypoint: "modules/questpulse/src/index.ts",
  dependencies: [],
  // Keep permissions empty until individual Q.P capabilities are reviewed and approved.
  requestedPermissions: [],
};

import type { ModuleManifest } from "../../../packages/contracts/src/module.js";

/** Internal circular-economy branch; all external capabilities remain disabled by default. */
export const circularEconomyManifest: ModuleManifest = {
  id: "circular-economy",
  displayName: "TLCE Circular Digital Economy",
  version: "0.1.0",
  description: "Discover, assess, verify, rehabilitate and recirculate underused digital assets.",
  apiVersion: "1",
  entrypoint: "modules/circular-economy/src/index.ts",
  dependencies: [],
  requestedPermissions: [],
};

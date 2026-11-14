import type { ModuleManifest } from "../../../packages/contracts/src/module.js";

/** Internal TLCE security branch; network and wallet capabilities are not enabled. */
export const trustCyberShieldManifest: ModuleManifest = {
  id: "trust-cybershield",
  displayName: "TLCE Trust & CyberShield",
  version: "0.1.0",
  description: "Personal digital safety, link and offer checks, contract risk review, and DNS posture diagnostics.",
  apiVersion: "1",
  entrypoint: "modules/trust-cybershield/src/index.ts",
  dependencies: [],
  requestedPermissions: [],
};

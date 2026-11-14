import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend.js";

export const trustCyberShieldMicroFrontendManifest: MicroFrontendManifest = {
  id: "trust-cybershield",
  displayName: "Trust & CyberShield",
  version: "0.1.0",
  apiVersion: "1",
  route: "/trust",
  entrypoint: "/assets/tlce/branches/trust-cybershield/entry.js",
  requestedCapabilities: [],
  dependencies: [],
};

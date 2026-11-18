import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend.js";

/** Same-origin packaging address reserved for a future immutable artifact. */
export const questPulseMicroFrontendManifest: MicroFrontendManifest = {
  id: "questpulse",
  displayName: "QuestPulse",
  version: "0.1.0",
  apiVersion: "1",
  route: "/questpulse",
  entrypoint: "/assets/tlce/branches/questpulse/entry.js",
  requestedCapabilities: [],
  dependencies: [],
};

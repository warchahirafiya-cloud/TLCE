import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend.js";

/**
 * The entrypoint is a same-origin packaging address reserved for a future
 * immutable build artifact. The current host uses a statically imported,
 * allowlisted adapter and does not fetch this path or execute remote code.
 */
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

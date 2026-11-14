import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend.js";
export const voiceProductivityMicroFrontendManifest: MicroFrontendManifest = {
  id: "voice-productivity", displayName: "Voice-First Productivity", version: "0.1.0", apiVersion: "1",
  route: "/voice", entrypoint: "/assets/tlce/branches/voice-productivity/entry.js",
  requestedCapabilities: [], dependencies: [],
};

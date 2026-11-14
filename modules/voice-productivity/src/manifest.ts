import type { ModuleManifest } from "../../../packages/contracts/src/module.js";
export const voiceProductivityManifest: ModuleManifest = {
  id: "voice-productivity", displayName: "TLCE Voice-First Productivity", version: "0.1.0",
  description: "Capture spoken ideas, structure projects and draft software, marketing and operational tasks for user review.",
  apiVersion: "1", entrypoint: "modules/voice-productivity/src/index.ts", dependencies: [], requestedPermissions: [],
};

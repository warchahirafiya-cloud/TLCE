import type { ProductBranchRegistry } from "../runtime/engine/src/product-branch-registry.js";
import { circularEconomyManifest } from "./circular-economy/src/manifest.js";
import { CircularEconomyModule } from "./circular-economy/src/index.js";
import { circularEconomyMicroFrontendManifest } from "./circular-economy/src/micro-frontend-manifest.js";
import { trustCyberShieldManifest } from "./trust-cybershield/src/manifest.js";
import { TrustCyberShieldModule } from "./trust-cybershield/src/index.js";
import { trustCyberShieldMicroFrontendManifest } from "./trust-cybershield/src/micro-frontend-manifest.js";
import { questPulseManifest } from "./questpulse/src/manifest.js";
import { QuestPulseModule } from "./questpulse/src/index.js";
import { questPulseMicroFrontendManifest } from "./questpulse/src/micro-frontend-manifest.js";
import { voiceProductivityManifest } from "./voice-productivity/src/manifest.js";
import { VoiceProductivityModule } from "./voice-productivity/src/index.js";
import { voiceProductivityMicroFrontendManifest } from "./voice-productivity/src/micro-frontend-manifest.js";

/** Single composition point for built-in product branches hosted by TLCE. */
export function registerBuiltInProductBranches(registry: ProductBranchRegistry): void {
  registry.register({ moduleManifest: questPulseManifest, frontendManifest: questPulseMicroFrontendManifest, implementation: new QuestPulseModule() });
  registry.register({ moduleManifest: trustCyberShieldManifest, frontendManifest: trustCyberShieldMicroFrontendManifest, implementation: new TrustCyberShieldModule() });
  registry.register({ moduleManifest: circularEconomyManifest, frontendManifest: circularEconomyMicroFrontendManifest, implementation: new CircularEconomyModule() });
  registry.register({ moduleManifest: voiceProductivityManifest, frontendManifest: voiceProductivityMicroFrontendManifest, implementation: new VoiceProductivityModule() });
}

import type { ProductBranchRegistry } from "../../../runtime/engine/src/product-branch-registry.js";
import { voiceProductivityManifest } from "./manifest.js";
import { VoiceProductivityModule } from "./index.js";
import { voiceProductivityMicroFrontendManifest } from "./micro-frontend-manifest.js";
export function registerVoiceProductivityBranch(registry: ProductBranchRegistry): void {
  registry.register({ moduleManifest: voiceProductivityManifest, frontendManifest: voiceProductivityMicroFrontendManifest, implementation: new VoiceProductivityModule() });
}

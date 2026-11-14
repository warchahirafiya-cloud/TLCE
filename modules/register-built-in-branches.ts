import type { ProductBranchRegistry } from "../runtime/engine/src/product-branch-registry.js";
import { questPulseManifest } from "./questpulse/src/manifest.js";
import { questPulseModule } from "./questpulse/src/index.js";
import { questPulseMicroFrontendManifest } from "./questpulse/src/micro-frontend-manifest.js";

/** Single composition point for built-in product branches hosted by TLCE. */
export function registerBuiltInProductBranches(registry: ProductBranchRegistry): void {
  registry.register({
    moduleManifest: questPulseManifest,
    frontendManifest: questPulseMicroFrontendManifest,
    implementation: questPulseModule,
  });
}

import type { ProductBranchRegistry } from "../../../runtime/engine/src/product-branch-registry.js";
import { circularEconomyManifest } from "./manifest.js";
import { CircularEconomyModule } from "./index.js";
import { circularEconomyMicroFrontendManifest } from "./micro-frontend-manifest.js";

/** Registers this product branch through the parent TLCE registry only. */
export function registerCircularEconomyBranch(registry: ProductBranchRegistry): void {
  registry.register({
    moduleManifest: circularEconomyManifest,
    frontendManifest: circularEconomyMicroFrontendManifest,
    implementation: new CircularEconomyModule(),
  });
}

import type { ProductBranchRegistry } from "../../../runtime/engine/src/product-branch-registry.js";
import { trustCyberShieldManifest } from "./manifest.js";
import { TrustCyberShieldModule } from "./index.js";
import { trustCyberShieldMicroFrontendManifest } from "./micro-frontend-manifest.js";

/** Registers the security branch inside the TLCE parent registry. */
export function registerTrustCyberShieldBranch(registry: ProductBranchRegistry): void {
  registry.register({
    moduleManifest: trustCyberShieldManifest,
    frontendManifest: trustCyberShieldMicroFrontendManifest,
    implementation: new TrustCyberShieldModule(),
  });
}

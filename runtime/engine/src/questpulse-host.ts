import type { MicroFrontendContext, MicroFrontendLoader } from "../../../packages/contracts/src/micro-frontend.js";
import { registerBuiltInProductBranches } from "../../../modules/register-built-in-branches.js";
import { questPulseMicroFrontend } from "../../../modules/questpulse/src/micro-frontend.js";
import { ModuleRegistry } from "./module-registry.js";
import { RuntimeEngine } from "./runtime-engine.js";
import { MicroFrontendRegistry } from "./micro-frontend-registry.js";
import { MicroFrontendHost } from "./micro-frontend-host.js";
import { ProductBranchRegistry } from "./product-branch-registry.js";

export interface TLCEHostOptions {
  /** Parent-owned, authorization-aware service facade. */
  services: MicroFrontendContext["services"];
}

/** Creates the single TLCE parent host with built-in branches registered. */
export function createTLCEHost(options: TLCEHostOptions) {
  const moduleRegistry = new ModuleRegistry();
  const frontendRegistry = new MicroFrontendRegistry();
  const branchRegistry = new ProductBranchRegistry(moduleRegistry, frontendRegistry);
  registerBuiltInProductBranches(branchRegistry);

  const runtime = new RuntimeEngine(moduleRegistry);
  const loader: MicroFrontendLoader = async (manifest) => {
    if (manifest.id !== "questpulse" || manifest.version !== "0.1.0") {
      throw new Error("No approved in-process loader exists for this product branch");
    }
    return questPulseMicroFrontend;
  };
  const frontendHost = new MicroFrontendHost(frontendRegistry, loader);

  return {
    branchRegistry,
    moduleRegistry,
    frontendRegistry,
    runtime,
    frontendHost,

    async mount(
      root: HTMLElement,
      requestId: string,
      grantedCapabilities: ReadonlySet<string>,
      route = "/questpulse",
    ): Promise<void> {
      if (!requestId || typeof requestId !== "string" || !requestId.trim()) {
        throw new Error("A request id is required");
      }
      const owner = branchRegistry.resolveRoute(route);
      if (!owner || owner.id !== "questpulse") {
        throw new Error("Route does not match registered QuestPulse namespace");
      }
      await runtime.startModule("questpulse");
      try {
        await frontendHost.mount(
          "questpulse", root, requestId, grantedCapabilities, options.services, route,
        );
      } catch (error) {
        try { await runtime.stopModule("questpulse"); } catch { /* preserve mount failure */ }
        throw error;
      }
    },

    async unmount(): Promise<boolean> {
      try {
        return await frontendHost.unmount("questpulse");
      } finally {
        await runtime.stopModule("questpulse");
      }
    },
  };
}

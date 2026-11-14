import type { MicroFrontendContext, MicroFrontendLoader } from "../../../packages/contracts/src/micro-frontend.js";
import { registerBuiltInProductBranches } from "../../../modules/register-built-in-branches.js";
import { questPulseMicroFrontend } from "../../../modules/questpulse/src/micro-frontend.js";
import { ModuleRegistry } from "./module-registry.js";
import { RuntimeEngine } from "./runtime-engine.js";
import { MicroFrontendRegistry } from "./micro-frontend-registry.js";
import { MicroFrontendHost } from "./micro-frontend-host.js";
import { ProductBranchRegistry } from "./product-branch-registry.js";

export interface QuestPulseHostOptions {
  /** Parent-owned, authorization-aware service facade. */
  services: MicroFrontendContext["services"];
}

export function createQuestPulseHost(options: QuestPulseHostOptions) {
  const moduleRegistry = new ModuleRegistry();
  const frontendRegistry = new MicroFrontendRegistry();
  const branchRegistry = new ProductBranchRegistry(moduleRegistry, frontendRegistry);
  registerBuiltInProductBranches(branchRegistry);

  const runtime = new RuntimeEngine(moduleRegistry);
  const loader: MicroFrontendLoader = async (manifest) => {
    // Static allowlist only: no arbitrary URL, remote import, or user-controlled code.
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
      await runtime.startModule("questpulse");
      try {
        await frontendHost.mount(
          "questpulse",
          root,
          requestId,
          grantedCapabilities,
          options.services,
          route,
        );
      } catch (error) {
        await runtime.stopModule("questpulse");
        throw error;
      }
    },

    async unmount(): Promise<boolean> {
      const unmounted = await frontendHost.unmount("questpulse");
      await runtime.stopModule("questpulse");
      return unmounted;
    },
  };
}

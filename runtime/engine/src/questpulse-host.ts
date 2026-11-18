import type { ModuleContext, ModuleHealth, ModuleManifest, TLCEModule } from "../../../packages/contracts/src/module";
import { ModuleRegistry } from "./module-registry";
import { RuntimeEngine } from "./runtime-engine";

export interface QuestPulseHostServices {
  request(...args: unknown[]): Promise<unknown>;
  publish(...args: unknown[]): unknown;
  subscribe(...args: unknown[]): unknown;
}

export interface TLCEHostOptions {
  services: QuestPulseHostServices;
}

export interface TLCEBranch {
  id: string;
  route: string;
  manifest: ModuleManifest;
}

const QUESTPULSE_MANIFEST: ModuleManifest = {
  id: "questpulse",
  displayName: "QuestPulse",
  version: "0.1.0",
  description: "QuestPulse product branch hosted inside the TLCE runtime.",
  apiVersion: "1",
  entrypoint: "./modules/questpulse",
  dependencies: [],
  requestedPermissions: [],
};

function createQuestPulseModule(_services: QuestPulseHostServices): TLCEModule {
  let initialized = false;
  let active = false;

  return {
    async initialize(_context: ModuleContext): Promise<void> {
      initialized = true;
    },
    async start(): Promise<void> {
      if (!initialized) throw new Error("QuestPulse must be initialized before start");
      active = true;
    },
    async health(): Promise<ModuleHealth> {
      return {
        state: active ? "ready" : initialized ? "initialized" : "registered",
        checkedAt: new Date().toISOString(),
      };
    },
    async stop(): Promise<void> {
      active = false;
    },
  };
}

function createBranchRegistry() {
  const branches = new Map<string, TLCEBranch>([
    ["questpulse", {
      id: "questpulse",
      route: "/questpulse",
      manifest: { ...QUESTPULSE_MANIFEST },
    }],
  ]);

  return {
    get(branchId: string): TLCEBranch | undefined {
      const branch = branches.get(branchId);
      return branch ? { ...branch, manifest: { ...branch.manifest } } : undefined;
    },
    list(): ReadonlyArray<TLCEBranch> {
      return [...branches.values()].map((branch) => ({
        ...branch,
        manifest: { ...branch.manifest },
      }));
    },
  };
}

function createFrontendHost() {
  const mounted = new Map<string, HTMLElement>();

  return {
    mount(root: HTMLElement, branchId: string): void {
      if (mounted.has(branchId)) return;
      const element = root.ownerDocument.createElement("section");
      element.setAttribute("data-tlce-branch", branchId);
      element.setAttribute("aria-label", "QuestPulse module host");
      root.replaceChildren(element);
      mounted.set(branchId, root);
    },
    unmount(branchId: string): boolean {
      const root = mounted.get(branchId);
      if (!root) return false;
      root.replaceChildren();
      mounted.delete(branchId);
      return true;
    },
    isMounted(branchId: string): boolean {
      return mounted.has(branchId);
    },
  };
}

export function createTLCEHost(options: TLCEHostOptions) {
  const branchRegistry = createBranchRegistry();
  const registry = new ModuleRegistry();
  registry.register(QUESTPULSE_MANIFEST, createQuestPulseModule(options.services));

  const runtime = new RuntimeEngine(registry);
  const frontendHost = createFrontendHost();
  let mountedBranch: string | undefined;

  return {
    branchRegistry,
    runtime,
    frontendHost,

    async mount(
      root: HTMLElement,
      requestId: string,
      _capabilities: ReadonlySet<string>,
      route: string,
    ): Promise<void> {
      const branch = branchRegistry.get("questpulse");
      if (!branch || !(route === branch.route || route.startsWith(`${branch.route}/`))) {
        throw new Error(`Route ${route} does not match registered QuestPulse namespace`);
      }
      if (mountedBranch && mountedBranch !== branch.id) {
        throw new Error(`Another TLCE branch is already mounted: ${mountedBranch}`);
      }
      if (frontendHost.isMounted(branch.id)) return;

      await runtime.startModule(branch.id);
      try {
        frontendHost.mount(root, branch.id);
        mountedBranch = branch.id;
      } catch (error) {
        await runtime.stopModule(branch.id);
        throw error;
      }
      void requestId;
    },

    async unmount(): Promise<boolean> {
      if (!mountedBranch) return false;
      const branchId = mountedBranch;
      const didUnmount = frontendHost.unmount(branchId);
      await runtime.stopModule(branchId);
      mountedBranch = undefined;
      return didUnmount;
    },
  };
}

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
  /** Same-origin URL containing the deployed QuestPulse index.html and assets. */
  frontendBaseUrl?: string;
}

export interface TLCEBranch {
  id: string;
  route: string;
  manifest: ModuleManifest;
}

type QuestPulseFrontendModule = {
  mountQuestPulse(root: HTMLElement): () => void;
};

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

async function mountQuestPulseFrontend(
  root: HTMLElement,
  frontendBaseUrl: string,
): Promise<() => void> {
  const documentRef = root.ownerDocument;
  const baseUrl = new URL(frontendBaseUrl, documentRef.baseURI);
  const documentUrl = new URL("index.html", baseUrl);
  const pageUrl = new URL(documentUrl.href);

  if (baseUrl.origin !== new URL(documentRef.baseURI).origin) {
    throw new Error("QuestPulse frontend must be hosted on the same origin as TLCE");
  }
  if (!baseUrl.pathname.endsWith("/")) {
    throw new Error("QuestPulse frontend base URL must end with a slash");
  }

  const response = await fetch(documentUrl, {
    headers: { Accept: "text/html" },
    credentials: "same-origin",
    redirect: "error",
  });
  if (!response.ok) throw new Error(`QuestPulse frontend request failed: ${response.status}`);

  const Parser = documentRef.defaultView?.DOMParser;
  if (!Parser) throw new Error("DOMParser is unavailable in this document");
  const parsed = new Parser().parseFromString(await response.text(), "text/html");
  const main = parsed.querySelector("main#main");
  if (!main) throw new Error("QuestPulse frontend document is missing main#main");

  const mountPoint = documentRef.createElement("div");
  mountPoint.className = "tlce-questpulse-frontend";
  mountPoint.setAttribute("data-tlce-questpulse-frontend", "true");

  const styleLinks: HTMLLinkElement[] = [];
  for (const link of Array.from(parsed.querySelectorAll('link[rel="stylesheet"][href]'))) {
    const href = new URL(link.getAttribute("href") ?? "", pageUrl);
    if (href.origin !== baseUrl.origin) {
      throw new Error("QuestPulse stylesheet must use the TLCE origin");
    }
    const style = documentRef.createElement("link");
    style.rel = "stylesheet";
    style.href = href.href;
    style.dataset.tlceQuestpulseStyle = "true";
    documentRef.head.append(style);
    styleLinks.push(style);
  }

  const bodyNodes = Array.from(parsed.body.childNodes).filter((node) =>
    !(node instanceof (documentRef.defaultView?.HTMLScriptElement ?? HTMLScriptElement)),
  );
  for (const node of bodyNodes) mountPoint.append(documentRef.importNode(node, true));
  root.replaceChildren(mountPoint);

  try {
    const moduleUrl = new URL("questpulse.js", baseUrl).href;
    const app = await import(moduleUrl) as QuestPulseFrontendModule;
    if (typeof app.mountQuestPulse !== "function") {
      throw new Error("QuestPulse frontend does not export mountQuestPulse");
    }
    const unmountApp = app.mountQuestPulse(mountPoint);
    return () => {
      unmountApp();
      root.replaceChildren();
      for (const style of styleLinks) style.remove();
    };
  } catch (error) {
    root.replaceChildren();
    for (const style of styleLinks) style.remove();
    throw error;
  }
}

function createFrontendHost(frontendBaseUrl: string) {
  const mounted = new Map<string, { root: HTMLElement; dispose: () => void }>();

  return {
    async mount(root: HTMLElement, branchId: string): Promise<void> {
      if (mounted.has(branchId)) return;
      const dispose = await mountQuestPulseFrontend(root, frontendBaseUrl);
      mounted.set(branchId, { root, dispose });
    },
    unmount(branchId: string): boolean {
      const entry = mounted.get(branchId);
      if (!entry) return false;
      entry.dispose();
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
  const frontendHost = createFrontendHost(options.frontendBaseUrl ?? "/apps/web/");
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
        await frontendHost.mount(root, branch.id);
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

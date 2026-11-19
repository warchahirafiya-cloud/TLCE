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
  /** Internal adapter seam for deterministic host tests. Never populate from user input. */
  frontendMount?: (root: HTMLElement, frontendBaseUrl: string) => Promise<() => void>;
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
  if (baseUrl.origin !== new URL(documentRef.baseURI).origin) {
    throw new Error("QuestPulse frontend must be hosted on the same origin as TLCE");
  }
  if (!baseUrl.pathname.endsWith("/")) {
    throw new Error("QuestPulse frontend base URL must end with a slash");
  }

  const documentUrl = new URL("index.html", baseUrl);
  const response = await fetch(documentUrl, {
    headers: { Accept: "text/html" },
    credentials: "same-origin",
    redirect: "error",
  });
  if (!response.ok) throw new Error(`QuestPulse frontend request failed: ${response.status}`);

  const Parser = documentRef.defaultView?.DOMParser;
  if (!Parser) throw new Error("DOMParser is unavailable in this document");
  const parsed = new Parser().parseFromString(await response.text(), "text/html");
  if (!parsed.querySelector("main#main")) {
    throw new Error("QuestPulse frontend document is missing main#main");
  }

  const hostElement = documentRef.createElement("div");
  hostElement.className = "tlce-questpulse-frontend";
  hostElement.setAttribute("data-tlce-questpulse-frontend", "true");
  const shadow = hostElement.attachShadow({ mode: "open" });

  const mountPoint = documentRef.createElement("div");
  mountPoint.className = "questpulse-app-root";
  mountPoint.lang = "ar";
  mountPoint.dir = "rtl";

  const body = parsed.body.cloneNode(true) as HTMLElement;
  for (const script of Array.from(body.querySelectorAll("script"))) script.remove();
  for (const node of Array.from(body.childNodes)) {
    mountPoint.append(documentRef.importNode(node, true));
  }
  shadow.append(mountPoint);

  const stylesheetUrl = new URL("styles.runtime.css", baseUrl);
  const stylesheet = documentRef.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = stylesheetUrl.href;

  root.replaceChildren(hostElement);

  try {
    const stylesheetLoaded = new Promise<void>((resolve, reject) => {
      stylesheet.onload = () => resolve();
      stylesheet.onerror = () => reject(new Error("QuestPulse runtime stylesheet failed to load"));
    });
    shadow.prepend(stylesheet);
    await stylesheetLoaded;

    const moduleUrl = new URL("questpulse.js", baseUrl).href;
    const app = await import(moduleUrl) as QuestPulseFrontendModule;
    if (typeof app.mountQuestPulse !== "function") {
      throw new Error("QuestPulse frontend does not export mountQuestPulse");
    }
    const unmountApp = app.mountQuestPulse(mountPoint);
    return () => {
      try {
        unmountApp();
      } finally {
        root.replaceChildren();
      }
    };
  } catch (error) {
    root.replaceChildren();
    throw error;
  }
}

function createFrontendHost(
  frontendBaseUrl: string,
  mountFrontend: typeof mountQuestPulseFrontend,
) {
  const mounted = new Map<string, { root: HTMLElement; dispose: () => void }>();
  const mounting = new Map<string, Promise<void>>();

  return {
    async mount(root: HTMLElement, branchId: string): Promise<void> {
      if (mounted.has(branchId)) return;
      const inFlight = mounting.get(branchId);
      if (inFlight) return inFlight;

      const operation = (async () => {
        const dispose = await mountFrontend(root, frontendBaseUrl);
        mounted.set(branchId, { root, dispose });
      })();
      mounting.set(branchId, operation);
      try {
        await operation;
      } finally {
        if (mounting.get(branchId) === operation) mounting.delete(branchId);
      }
    },
    async unmount(branchId: string): Promise<boolean> {
      const inFlight = mounting.get(branchId);
      if (inFlight) {
        try {
          await inFlight;
        } catch {
          return false;
        }
      }
      const entry = mounted.get(branchId);
      if (!entry) return false;
      try {
        entry.dispose();
      } finally {
        mounted.delete(branchId);
        entry.root.replaceChildren();
      }
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
  const frontendHost = createFrontendHost(
    options.frontendBaseUrl ?? "/apps/web/",
    options.frontendMount ?? mountQuestPulseFrontend,
  );
  let mountedBranch: string | undefined;
  let lifecycle = Promise.resolve();

  // Serialize mount/unmount transitions so navigation cannot interleave lifecycle changes.
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = lifecycle.then(operation, operation);
    lifecycle = result.then(() => undefined, () => undefined);
    return result;
  }

  return {
    branchRegistry,
    runtime,
    frontendHost,

    mount(
      root: HTMLElement,
      requestId: string,
      _capabilities: ReadonlySet<string>,
      route: string,
    ): Promise<void> {
      const branch = branchRegistry.get("questpulse");
      if (!branch || !(route === branch.route || route.startsWith(`${branch.route}/`))) {
        return Promise.reject(new Error(`Route ${route} does not match registered QuestPulse namespace`));
      }

      return serialize(async () => {
        if (mountedBranch === branch.id || frontendHost.isMounted(branch.id)) return;
        if (mountedBranch && mountedBranch !== branch.id) {
          throw new Error(`Another TLCE branch is already mounted: ${mountedBranch}`);
        }

        await runtime.startModule(branch.id);
        try {
          await frontendHost.mount(root, branch.id);
          mountedBranch = branch.id;
        } catch (error) {
          try {
            await runtime.stopModule(branch.id);
          } catch {
            // Preserve the original frontend mount failure.
          }
          throw error;
        }
        void requestId;
      });
    },

    unmount(): Promise<boolean> {
      return serialize(async () => {
        if (!mountedBranch) return false;
        const branchId = mountedBranch;
        try {
          return await frontendHost.unmount(branchId);
        } finally {
          mountedBranch = undefined;
          await runtime.stopModule(branchId);
        }
      });
    },
  };
}

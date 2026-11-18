import type {
  MicroFrontendContext, MicroFrontendInstance, MicroFrontendLoader, MicroFrontendServices,
} from "../../../packages/contracts/src/micro-frontend.js";
import { MicroFrontendRegistry } from "./micro-frontend-registry.js";

const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const EVENT_NAME = /^[a-z][a-z0-9._:-]{1,127}$/;
const API_PATH = /^\\/(?!\\/)[a-zA-Z0-9._~!$&'()*+,;=:@%/?#-]*$/;

function isSafeApiPath(path: string): boolean {
  if (!API_PATH.test(path) || path.includes("\\\\")) return false;
  try {
    const decoded = decodeURIComponent(path.split(/[?#]/, 1)[0]);
    return !decoded.includes("\\\\") && !decoded.split("/").some((part) => part === "." || part === "..");
  } catch {
    return false;
  }
}

function scopedServices(
  moduleId: string,
  granted: ReadonlySet<string>,
  services: MicroFrontendContext["services"],
): MicroFrontendContext["services"] {
  const facade: MicroFrontendServices = {
    async request(input: { capability: string; method: string; path: string; body?: unknown }) {
      if (!input || typeof input !== "object" || typeof input.capability !== "string" ||
          !granted.has(input.capability)) {
        throw new Error("Micro-frontend service capability denied");
      }
      if (typeof input.method !== "string" || !METHODS.has(input.method.toUpperCase())) {
        throw new Error("Unsupported service method");
      }
      if (typeof input.path !== "string" || !isSafeApiPath(input.path)) {
        throw new Error("Invalid service API path");
      }
      return services.request({ ...input, method: input.method.toUpperCase() });
    },
    publish(eventName: string, payload: unknown) {
      if (!granted.has("events.publish")) throw new Error("Micro-frontend event publish denied");
      if (typeof eventName !== "string" || !EVENT_NAME.test(eventName) ||
          !(eventName.startsWith(moduleId + ".") || eventName.startsWith("tlce."))) {
        throw new Error("Micro-frontend event namespace denied");
      }
      services.publish(eventName, payload);
    },
    subscribe(eventName: string, handler: (payload: unknown) => void) {
      if (!granted.has("events.subscribe")) throw new Error("Micro-frontend event subscription denied");
      if (typeof eventName !== "string" || !EVENT_NAME.test(eventName) ||
          !(eventName.startsWith(moduleId + ".") || eventName.startsWith("tlce.")) ||
          typeof handler !== "function") {
        throw new Error("Micro-frontend event subscription denied");
      }
      return services.subscribe(eventName, handler);
    },
  };
  return Object.freeze(facade);
}

export class MicroFrontendHost {
  private readonly active = new Map<string, MicroFrontendInstance>();
  private readonly mounting = new Set<string>();

  constructor(
    private readonly registry: MicroFrontendRegistry,
    private readonly loader: MicroFrontendLoader,
  ) {}

  async mount(id: string, root: HTMLElement, requestId: string, grantedCapabilities: ReadonlySet<string>,
    services: MicroFrontendContext["services"], route: string): Promise<void> {
    if (this.active.has(id) || this.mounting.has(id)) throw new Error("Micro-frontend is already mounted or mounting");
    const manifest = this.registry.get(id);
    if (!manifest) throw new Error("Micro-frontend is not registered");
    const routeOwner = this.registry.resolveRoute(route);
    if (!routeOwner || routeOwner.id !== id) throw new Error("Route does not match registered micro-frontend");
    if (!requestId || typeof requestId !== "string") throw new Error("A request id is required");
    for (const capability of manifest.requestedCapabilities) {
      if (!grantedCapabilities.has(capability)) throw new Error("Missing required micro-frontend capability");
    }
    this.registry.resolveStartOrder(id);
    this.mounting.add(id);
    try {
      const module = await this.loader(manifest);
      if (!module || typeof module.mount !== "function") throw new Error("Invalid micro-frontend module");
      const granted = new Set(manifest.requestedCapabilities.filter((capability) => grantedCapabilities.has(capability)));
      const context: MicroFrontendContext = {
        frontendId: manifest.id,
        frontendVersion: manifest.version,
        requestId,
        grantedCapabilities: granted,
        services: scopedServices(manifest.id, granted, services),
      };
      const instance = await module.mount({ root, context, route });
      if (!instance || typeof instance.unmount !== "function") throw new Error("Micro-frontend returned an invalid instance");
      this.active.set(id, instance);
    } finally {
      this.mounting.delete(id);
    }
  }

  async unmount(id: string): Promise<boolean> {
    const instance = this.active.get(id);
    if (!instance) return false;
    this.active.delete(id);
    await instance.unmount();
    return true;
  }

  async unmountAll(): Promise<void> {
    const ids = [...this.active.keys()].reverse();
    const failures: unknown[] = [];
    for (const id of ids) {
      try { await this.unmount(id); } catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, "One or more micro-frontends failed to unmount");
  }

  isMounted(id: string): boolean { return this.active.has(id); }
  isMounting(id: string): boolean { return this.mounting.has(id); }
}

import type {
  MicroFrontendContext, MicroFrontendInstance, MicroFrontendLoader, MicroFrontendManifest,
} from "../../../packages/contracts/src/micro-frontend";
import { MicroFrontendRegistry } from "./micro-frontend-registry";

export class MicroFrontendHost {
  private readonly active = new Map<string, MicroFrontendInstance>();

  constructor(
    private readonly registry: MicroFrontendRegistry,
    private readonly loader: MicroFrontendLoader,
  ) {}

  async mount(id: string, root: HTMLElement, requestId: string, grantedCapabilities: ReadonlySet<string>,
    services: MicroFrontendContext["services"], route: string): Promise<void> {
    if (this.active.has(id)) throw new Error("Micro-frontend is already mounted");
    const manifest = this.registry.get(id);
    if (!manifest) throw new Error("Micro-frontend is not registered");
    if (route !== manifest.route) throw new Error("Route does not match registered micro-frontend");
    for (const capability of manifest.requestedCapabilities) {
      if (!grantedCapabilities.has(capability)) throw new Error("Missing required micro-frontend capability");
    }
    this.registry.resolveStartOrder(id);
    const module = await this.loader(manifest);
    if (!module || typeof module.mount !== "function") throw new Error("Invalid micro-frontend module");
    const context: MicroFrontendContext = {
      frontendId: manifest.id,
      frontendVersion: manifest.version,
      requestId,
      grantedCapabilities: new Set(manifest.requestedCapabilities.filter((capability) => grantedCapabilities.has(capability))),
      services,
    };
    const instance = await module.mount({ root, context, route });
    if (!instance || typeof instance.unmount !== "function") throw new Error("Micro-frontend returned an invalid instance");
    this.active.set(id, instance);
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
}

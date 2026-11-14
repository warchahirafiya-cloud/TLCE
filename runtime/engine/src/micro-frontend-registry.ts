import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend";

const ID = /^[a-z][a-z0-9-]{2,63}$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const CAPABILITY = /^[a-z][a-z0-9._:-]{1,127}$/;
const ROUTE = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/;

function clone(manifest: MicroFrontendManifest): MicroFrontendManifest {
  return { ...manifest, requestedCapabilities: [...manifest.requestedCapabilities], dependencies: manifest.dependencies.map((item) => ({ ...item })) };
}

export class MicroFrontendRegistry {
  private readonly entries = new Map<string, MicroFrontendManifest>();

  register(manifest: MicroFrontendManifest): void {
    if (!manifest || typeof manifest !== "object") throw new Error("Invalid micro-frontend manifest");
    if (typeof manifest.id !== "string" || !ID.test(manifest.id)) throw new Error("Invalid micro-frontend id");
    if (typeof manifest.version !== "string" || !VERSION.test(manifest.version)) throw new Error("Invalid micro-frontend version");
    if (typeof manifest.displayName !== "string" || !manifest.displayName.trim()) throw new Error("Display name is required");
    if (typeof manifest.apiVersion !== "string" || !manifest.apiVersion.trim()) throw new Error("API version is required");
    if (typeof manifest.route !== "string" || !ROUTE.test(manifest.route) || manifest.route === "/") throw new Error("Invalid micro-frontend route");
    if (typeof manifest.entrypoint !== "string" || !manifest.entrypoint.startsWith("/") ||
        manifest.entrypoint.startsWith("//") || manifest.entrypoint.includes("..") ||
        manifest.entrypoint.includes("\\\\")) throw new Error("Entrypoint must be a same-origin absolute asset path");
    if (!Array.isArray(manifest.requestedCapabilities) || !Array.isArray(manifest.dependencies)) throw new Error("Capabilities and dependencies must be arrays");
    if (manifest.requestedCapabilities.some((value) => typeof value !== "string" || !CAPABILITY.test(value)) ||
        new Set(manifest.requestedCapabilities).size !== manifest.requestedCapabilities.length) throw new Error("Invalid or duplicate capability");
    const seen = new Set<string>();
    for (const dependency of manifest.dependencies) {
      if (!dependency || typeof dependency.id !== "string" || !ID.test(dependency.id) ||
          typeof dependency.version !== "string" || !VERSION.test(dependency.version) ||
          dependency.id === manifest.id || seen.has(dependency.id)) throw new Error("Invalid micro-frontend dependency");
      seen.add(dependency.id);
    }
    if (this.entries.has(manifest.id)) throw new Error("Micro-frontend already registered");
    for (const existing of this.entries.values()) {
      if (existing.route === manifest.route) throw new Error("Micro-frontend route already registered");
    }
    this.entries.set(manifest.id, clone(manifest));
  }

  get(id: string): MicroFrontendManifest | undefined {
    const item = this.entries.get(id);
    return item ? clone(item) : undefined;
  }

  list(): ReadonlyArray<MicroFrontendManifest> {
    return [...this.entries.values()].map(clone);
  }

  resolveStartOrder(id: string): ReadonlyArray<MicroFrontendManifest> {
    const result: MicroFrontendManifest[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (current: string) => {
      if (visited.has(current)) return;
      if (visiting.has(current)) throw new Error("Micro-frontend dependency cycle detected");
      const item = this.entries.get(current);
      if (!item) throw new Error("Missing micro-frontend dependency");
      visiting.add(current);
      for (const dependency of item.dependencies) {
        const found = this.entries.get(dependency.id);
        if (!found) throw new Error("Missing micro-frontend dependency");
        if (found.version !== dependency.version) throw new Error("Incompatible micro-frontend dependency");
        visit(dependency.id);
      }
      visiting.delete(current);
      visited.add(current);
      result.push(clone(item));
    };
    visit(id);
    return result;
  }
}

import type { ModuleManifest, TLCEModule } from "../../../packages/contracts/src/module.js";
import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend.js";
import { ModuleRegistry } from "./module-registry.js";
import { MicroFrontendRegistry } from "./micro-frontend-registry.js";

export interface ProductBranchDefinition {
  moduleManifest: ModuleManifest;
  frontendManifest: MicroFrontendManifest;
  implementation: TLCEModule;
}

export interface ProductBranchRecord {
  id: string;
  version: string;
  route: string;
  apiVersion: string;
}

function snapshot(record: ProductBranchRecord): ProductBranchRecord {
  return { ...record };
}

/** One parent-owned catalog coordinates module lifecycle and route registration. */
export class ProductBranchRegistry {
  private readonly branches = new Map<string, ProductBranchRecord>();

  constructor(
    private readonly modules: ModuleRegistry,
    private readonly frontends: MicroFrontendRegistry,
  ) {}

  register(definition: ProductBranchDefinition): void {
    const { moduleManifest, frontendManifest, implementation } = definition;
    if (!moduleManifest || !frontendManifest || !implementation) {
      throw new Error("A product branch requires module, frontend, and implementation definitions");
    }
    if (moduleManifest.id !== frontendManifest.id ||
        moduleManifest.version !== frontendManifest.version ||
        moduleManifest.apiVersion !== frontendManifest.apiVersion) {
      throw new Error("Product branch module and frontend manifests must share id, version, and API version");
    }
    if (this.branches.has(moduleManifest.id) ||
        this.modules.get(moduleManifest.id) ||
        this.frontends.get(frontendManifest.id)) {
      throw new Error("Product branch is already registered");
    }
    if (this.frontends.list().some((item) => item.route === frontendManifest.route)) {
      throw new Error("Product branch route is already registered");
    }

    const modulePreflight = new ModuleRegistry();
    modulePreflight.register(moduleManifest, implementation);
    const frontendPreflight = new MicroFrontendRegistry();
    frontendPreflight.register(frontendManifest);

    this.modules.register(moduleManifest, implementation);
    this.frontends.register(frontendManifest);
    this.branches.set(moduleManifest.id, {
      id: moduleManifest.id,
      version: moduleManifest.version,
      route: frontendManifest.route,
      apiVersion: moduleManifest.apiVersion,
    });
  }

  get(id: string): ProductBranchRecord | undefined {
    const item = this.branches.get(id);
    return item ? snapshot(item) : undefined;
  }

  list(): ReadonlyArray<ProductBranchRecord> {
    return [...this.branches.values()].map(snapshot);
  }

  resolveRoute(pathname: string): ProductBranchRecord | undefined {
    const manifest = this.frontends.resolveRoute(pathname);
    if (!manifest) return undefined;
    const item = this.branches.get(manifest.id);
    return item ? snapshot(item) : undefined;
  }
}

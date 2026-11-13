import type { ModuleManifest, TLCEModule } from "../../../packages/contracts/src/module";

export interface RegisteredModule {
  manifest: ModuleManifest;
  implementation: TLCEModule;
}

const ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const VERSION_PATTERN = /^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z.-]+)?$/;

export class ModuleRegistry {
  private readonly modules = new Map<string, RegisteredModule>();

  register(manifest: ModuleManifest, implementation: TLCEModule): void {
    this.validate(manifest);
    if (this.modules.has(manifest.id)) {
      throw new Error(`Module already registered: ${manifest.id}`);
    }
    this.modules.set(manifest.id, { manifest, implementation });
  }

  get(moduleId: string): RegisteredModule | undefined {
    return this.modules.get(moduleId);
  }

  list(): ReadonlyArray<RegisteredModule> {
    return [...this.modules.values()];
  }

  private validate(manifest: ModuleManifest): void {
    if (!ID_PATTERN.test(manifest.id)) throw new Error("Invalid module id");
    if (!VERSION_PATTERN.test(manifest.version)) throw new Error("Invalid module version");
    if (!manifest.displayName.trim()) throw new Error("Module displayName is required");
    if (!manifest.apiVersion.trim()) throw new Error("Module apiVersion is required");
    if (!manifest.entrypoint.trim()) throw new Error("Module entrypoint is required");
    if (!Array.isArray(manifest.dependencies) || !Array.isArray(manifest.requestedPermissions)) {
      throw new Error("Module dependencies and requestedPermissions must be arrays");
    }
  }
}

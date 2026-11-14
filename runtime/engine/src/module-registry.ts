import type { ModuleManifest, TLCEModule } from "../../../packages/contracts/src/module";

export interface RegisteredModule {
  manifest: ModuleManifest;
  implementation: TLCEModule;
}

const ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export class ModuleRegistry {
  private readonly modules = new Map<string, RegisteredModule>();

  register(manifest: ModuleManifest, implementation: TLCEModule): void {
    this.validate(manifest);
    if (this.modules.has(manifest.id)) {
      throw new Error(`Module already registered: ${manifest.id}`);
    }
    // Store a defensive copy so callers cannot mutate registered dependency or permission policy.
    const snapshot: ModuleManifest = {
      ...manifest,
      dependencies: manifest.dependencies.map((dependency) => ({ ...dependency })),
      requestedPermissions: manifest.requestedPermissions.map((permission) => ({
        resource: permission.resource,
        actions: [...permission.actions],
      })),
    };
    this.modules.set(manifest.id, { manifest: snapshot, implementation });
  }

  get(moduleId: string): RegisteredModule | undefined {
    return this.modules.get(moduleId);
  }

  list(): ReadonlyArray<RegisteredModule> {
    return [...this.modules.values()];
  }

  /** Resolve dependencies before dependents; fail closed on missing, incompatible, or cyclic edges. */
  resolveStartOrder(moduleId: string): ReadonlyArray<RegisteredModule> {
    const ordered: RegisteredModule[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error(`Module dependency cycle detected at: ${id}`);
      const record = this.modules.get(id);
      if (!record) throw new Error(`Missing module dependency: ${id}`);

      visiting.add(id);
      for (const dependency of record.manifest.dependencies) {
        const dependencyRecord = this.modules.get(dependency.moduleId);
        if (!dependencyRecord) {
          throw new Error(`Missing module dependency: ${dependency.moduleId}`);
        }
        if (dependency.versionRange !== "*" &&
            dependencyRecord.manifest.version !== dependency.versionRange) {
          throw new Error(
            `Incompatible dependency ${dependency.moduleId}: required ${dependency.versionRange}, found ${dependencyRecord.manifest.version}`,
          );
        }
        visit(dependency.moduleId);
      }
      visiting.delete(id);
      visited.add(id);
      ordered.push(record);
    };

    visit(moduleId);
    return ordered;
  }

  private validate(manifest: ModuleManifest): void {
    if (!manifest || typeof manifest !== "object") throw new Error("Invalid module manifest");
    if (!ID_PATTERN.test(manifest.id)) throw new Error("Invalid module id");
    if (!VERSION_PATTERN.test(manifest.version)) throw new Error("Invalid module version");
    if (!manifest.displayName?.trim()) throw new Error("Module displayName is required");
    if (!manifest.apiVersion?.trim()) throw new Error("Module apiVersion is required");
    if (!manifest.entrypoint?.trim()) throw new Error("Module entrypoint is required");
    if (!Array.isArray(manifest.dependencies) || !Array.isArray(manifest.requestedPermissions)) {
      throw new Error("Module dependencies and requestedPermissions must be arrays");
    }
    for (const dependency of manifest.dependencies) {
      if (!ID_PATTERN.test(dependency.moduleId) ||
          (dependency.versionRange !== "*" && !VERSION_PATTERN.test(dependency.versionRange))) {
        throw new Error("Invalid module dependency declaration");
      }
    }
    for (const permission of manifest.requestedPermissions) {
      if (!permission.resource.trim() || !Array.isArray(permission.actions) ||
          permission.actions.some((action) => !action.trim())) {
        throw new Error("Invalid requested permission");
      }
    }
  }
}

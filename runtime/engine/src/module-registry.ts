import type { ModuleManifest, TLCEModule } from "../../../packages/contracts/src/module";

export interface RegisteredModule {
  manifest: ModuleManifest;
  implementation: TLCEModule;
}

const ID_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

function cloneManifest(manifest: ModuleManifest): ModuleManifest {
  return {
    ...manifest,
    dependencies: manifest.dependencies.map((dependency) => ({ ...dependency })),
    requestedPermissions: manifest.requestedPermissions.map((permission) => ({
      resource: permission.resource,
      actions: [...permission.actions],
    })),
  };
}

export class ModuleRegistry {
  private readonly modules = new Map<string, RegisteredModule>();

  register(manifest: ModuleManifest, implementation: TLCEModule): void {
    this.validate(manifest);
    if (this.modules.has(manifest.id)) {
      throw new Error(`Module already registered: ${manifest.id}`);
    }
    this.modules.set(manifest.id, {
      manifest: cloneManifest(manifest),
      implementation,
    });
  }

  /** Return a defensive manifest snapshot; callers cannot mutate registry policy. */
  get(moduleId: string): RegisteredModule | undefined {
    const record = this.modules.get(moduleId);
    return record ? { manifest: cloneManifest(record.manifest), implementation: record.implementation } : undefined;
  }

  list(): ReadonlyArray<RegisteredModule> {
    return [...this.modules.values()].map((record) => ({
      manifest: cloneManifest(record.manifest),
      implementation: record.implementation,
    }));
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
      ordered.push({
        manifest: cloneManifest(record.manifest),
        implementation: record.implementation,
      });
    };

    visit(moduleId);
    return ordered;
  }

  private validate(manifest: ModuleManifest): void {
    if (!manifest || typeof manifest !== "object") throw new Error("Invalid module manifest");
    if (typeof manifest.id !== "string" || !ID_PATTERN.test(manifest.id)) throw new Error("Invalid module id");
    if (typeof manifest.version !== "string" || !VERSION_PATTERN.test(manifest.version)) throw new Error("Invalid module version");
    if (typeof manifest.displayName !== "string" || !manifest.displayName.trim()) throw new Error("Module displayName is required");
    if (typeof manifest.apiVersion !== "string" || !manifest.apiVersion.trim()) throw new Error("Module apiVersion is required");
    if (typeof manifest.entrypoint !== "string" || !manifest.entrypoint.trim()) throw new Error("Module entrypoint is required");
    if (!Array.isArray(manifest.dependencies) || !Array.isArray(manifest.requestedPermissions)) {
      throw new Error("Module dependencies and requestedPermissions must be arrays");
    }

    const dependencyIds = new Set<string>();
    for (const dependency of manifest.dependencies) {
      if (!dependency || typeof dependency.moduleId !== "string" ||
          !ID_PATTERN.test(dependency.moduleId) ||
          typeof dependency.versionRange !== "string" ||
          (dependency.versionRange !== "*" && !VERSION_PATTERN.test(dependency.versionRange))) {
        throw new Error("Invalid module dependency declaration");
      }
      if (dependency.moduleId === manifest.id || dependencyIds.has(dependency.moduleId)) {
        throw new Error("Self or duplicate module dependency is not allowed");
      }
      dependencyIds.add(dependency.moduleId);
    }

    const resources = new Set<string>();
    for (const permission of manifest.requestedPermissions) {
      if (!permission || typeof permission.resource !== "string" ||
          !permission.resource.trim() || !Array.isArray(permission.actions) ||
          permission.actions.length === 0 ||
          permission.actions.some((action) => typeof action !== "string" || !action.trim())) {
        throw new Error("Invalid requested permission");
      }
      if (resources.has(permission.resource)) throw new Error("Duplicate permission resource");
      resources.add(permission.resource);
      if (new Set(permission.actions).size !== permission.actions.length) {
        throw new Error("Duplicate permission action");
      }
    }
  }
}

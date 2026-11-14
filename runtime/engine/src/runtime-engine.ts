import type { ModuleContext, ModuleHealth, ModulePermission } from "../../../packages/contracts/src/module";
import { ModuleRegistry } from "./module-registry";

export interface RuntimeOptions {
  requestIdFactory?: () => string;
  permissionPolicy?: (moduleId: string, requested: ReadonlyArray<ModulePermission>) => ReadonlyArray<ModulePermission>;
}

function copyPermissions(permissions: ReadonlyArray<ModulePermission>): ModulePermission[] {
  return permissions.map((permission) => ({
    resource: permission.resource,
    actions: [...permission.actions],
  }));
}

export class RuntimeEngine {
  private readonly active = new Set<string>();
  private readonly starting = new Map<string, Promise<void>>();
  private readonly requestIdFactory: () => string;
  private readonly permissionPolicy: NonNullable<RuntimeOptions["permissionPolicy"]>;

  constructor(
    private readonly registry: ModuleRegistry,
    options: RuntimeOptions = {},
  ) {
    this.requestIdFactory = options.requestIdFactory ?? (() => `tlce-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    // Safe default: no permissions are granted automatically.
    this.permissionPolicy = options.permissionPolicy ?? (() => []);
  }

  async startModule(moduleId: string): Promise<void> {
    if (!this.registry.get(moduleId)) throw new Error(`Unknown module: ${moduleId}`);
    const startOrder = this.registry.resolveStartOrder(moduleId);
    for (const registered of startOrder) {
      await this.startSingleModule(registered.manifest.id);
    }
  }

  private startSingleModule(moduleId: string): Promise<void> {
    if (this.active.has(moduleId)) return Promise.resolve();
    const pending = this.starting.get(moduleId);
    if (pending) return pending;

    const operation = this.performStartSingleModule(moduleId);
    this.starting.set(moduleId, operation);
    return operation.finally(() => {
      if (this.starting.get(moduleId) === operation) this.starting.delete(moduleId);
    });
  }

  private async performStartSingleModule(moduleId: string): Promise<void> {
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);

    const requested = copyPermissions(registered.manifest.requestedPermissions);
    const policyResult = this.permissionPolicy(moduleId, requested);
    const grantedPermissions = copyPermissions(policyResult);
    const requestedByResource = new Map(requested.map((permission) => [permission.resource, permission.actions]));
    const seenResources = new Set<string>();
    const unauthorized = grantedPermissions.some((grant) => {
      const allowedActions = requestedByResource.get(grant.resource);
      if (!allowedActions || seenResources.has(grant.resource) ||
          !Array.isArray(grant.actions) || grant.actions.length === 0 ||
          new Set(grant.actions).size !== grant.actions.length) return true;
      seenResources.add(grant.resource);
      return grant.actions.some((action) => !allowedActions.includes(action));
    });
    if (unauthorized) {
      throw new Error(`Permission policy granted permissions not requested by module: ${moduleId}`);
    }

    const context: ModuleContext = {
      moduleId,
      moduleVersion: registered.manifest.version,
      grantedPermissions,
      requestId: this.requestIdFactory(),
    };

    try {
      await registered.implementation.initialize(context);
      await registered.implementation.start();
      this.active.add(moduleId);
    } catch (error) {
      try { await registered.implementation.stop(); } catch { /* preserve original failure */ }
      throw error;
    }
  }

  async health(moduleId: string): Promise<ModuleHealth> {
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);
    return registered.implementation.health();
  }

  async stopModule(moduleId: string): Promise<void> {
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);
    await this.starting.get(moduleId);
    if (!this.active.has(moduleId)) return;
    await registered.implementation.stop();
    this.active.delete(moduleId);
  }

  isActive(moduleId: string): boolean {
    return this.active.has(moduleId);
  }
}

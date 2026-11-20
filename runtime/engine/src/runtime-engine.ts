import type { ModuleContext, ModuleHealth, ModulePermission, ModuleLifecycleState } from "../../../packages/contracts/src/module.js";
import { ModuleRegistry } from "./module-registry.js";

export interface RuntimeOptions {
  requestIdFactory?: () => string;
  permissionPolicy?: (moduleId: string, requested: ReadonlyArray<ModulePermission>) => ReadonlyArray<ModulePermission>;
}
function copyPermissions(permissions: ReadonlyArray<ModulePermission>): ModulePermission[] {
  return permissions.map((permission) => ({ resource: permission.resource, actions: [...permission.actions] }));
}
function freezePermissions(permissions: ModulePermission[]): ReadonlyArray<ModulePermission> {
  for (const permission of permissions) { Object.freeze(permission.actions); Object.freeze(permission); }
  return Object.freeze(permissions);
}
function validateHealth(health: ModuleHealth, moduleId: string): ModuleHealth {
  const states: ModuleLifecycleState[] = ["registered", "initialized", "ready", "degraded", "stopped", "failed"];
  if (!health || !states.includes(health.state) || typeof health.checkedAt !== "string" ||
      Number.isNaN(Date.parse(health.checkedAt)) ||
      (health.message !== undefined && typeof health.message !== "string")) {
    throw new Error(`Module returned an invalid health report: ${moduleId}`);
  }
  return { ...health };
}

export class RuntimeEngine {
  private readonly active = new Set<string>();
  private readonly starting = new Map<string, Promise<void>>();
  private readonly stopping = new Map<string, Promise<void>>();
  private readonly states = new Map<string, ModuleLifecycleState>();
  private readonly requestIdFactory: () => string;
  private readonly permissionPolicy: NonNullable<RuntimeOptions["permissionPolicy"]>;

  constructor(private readonly registry: ModuleRegistry, options: RuntimeOptions = {}) {
    this.requestIdFactory = options.requestIdFactory ?? (() => `tlce-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    this.permissionPolicy = options.permissionPolicy ?? (() => []);
  }

  async startModule(moduleId: string): Promise<void> {
    if (!this.registry.get(moduleId)) throw new Error(`Unknown module: ${moduleId}`);
    for (const registered of this.registry.resolveStartOrder(moduleId)) {
      await this.startSingleModule(registered.manifest.id);
    }
  }

  private startSingleModule(moduleId: string): Promise<void> {
    if (this.active.has(moduleId)) return Promise.resolve();
    const pending = this.starting.get(moduleId);
    if (pending) return pending;
    const stopping = this.stopping.get(moduleId);
    if (stopping) return stopping.then(() => this.startSingleModule(moduleId));

    this.states.set(moduleId, "initialized");
    const operation = this.performStartSingleModule(moduleId);
    this.starting.set(moduleId, operation);
    return operation.finally(() => {
      if (this.starting.get(moduleId) === operation) this.starting.delete(moduleId);
    });
  }

  private async performStartSingleModule(moduleId: string): Promise<void> {
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);
    try {
      const requested = copyPermissions(registered.manifest.requestedPermissions);
      const policyResult = this.permissionPolicy(moduleId, copyPermissions(requested));
      if (!Array.isArray(policyResult)) throw new Error("Permission policy must return an array");
      const grantedPermissions = copyPermissions(policyResult);
      const requestedByResource = new Map(requested.map((permission) => [permission.resource, permission.actions]));
      const seenResources = new Set<string>();
      const unauthorized = grantedPermissions.some((grant) => {
        if (!grant || typeof grant.resource !== "string" || !Array.isArray(grant.actions)) return true;
        const allowedActions = requestedByResource.get(grant.resource);
        if (!allowedActions || seenResources.has(grant.resource) || grant.actions.length === 0 ||
            grant.actions.some((action) => typeof action !== "string" || !action.trim()) ||
            new Set(grant.actions).size !== grant.actions.length) return true;
        seenResources.add(grant.resource);
        return grant.actions.some((action) => !allowedActions.includes(action));
      });
      if (unauthorized) throw new Error(`Permission policy granted permissions not requested by module: ${moduleId}`);

      const requestId = this.requestIdFactory();
      if (typeof requestId !== "string" || !requestId.trim()) throw new Error("Request ID factory must return a non-empty string");
      const context: ModuleContext = Object.freeze({
        moduleId, moduleVersion: registered.manifest.version,
        grantedPermissions: freezePermissions(grantedPermissions), requestId,
      });
      await registered.implementation.initialize(context);
      await registered.implementation.start();
      this.active.add(moduleId);
      this.states.set(moduleId, "ready");
    } catch (error) {
      this.active.delete(moduleId);
      this.states.set(moduleId, "failed");
      try { await registered.implementation.stop(); } catch { /* preserve original failure */ }
      throw error;
    }
  }

  async health(moduleId: string): Promise<ModuleHealth> {
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);
    const health = validateHealth(await registered.implementation.health(), moduleId);
    if (this.active.has(moduleId)) this.states.set(moduleId, health.state);
    return health;
  }

  async stopModule(moduleId: string): Promise<void> {
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);
    const starting = this.starting.get(moduleId);
    if (starting) { try { await starting; } catch { return; } }
    const pending = this.stopping.get(moduleId);
    if (pending) return pending;
    if (!this.active.has(moduleId)) return;

    const operation = (async () => {
      await registered.implementation.stop();
      this.active.delete(moduleId);
      this.states.set(moduleId, "stopped");
    })();
    this.stopping.set(moduleId, operation);
    try { await operation; }
    catch (error) { this.states.set(moduleId, "failed"); throw error; }
    finally { if (this.stopping.get(moduleId) === operation) this.stopping.delete(moduleId); }
  }

  isActive(moduleId: string): boolean { return this.active.has(moduleId); }
  lifecycleState(moduleId: string): ModuleLifecycleState {
    if (!this.registry.get(moduleId)) throw new Error(`Unknown module: ${moduleId}`);
    return this.states.get(moduleId) ?? "registered";
  }
}

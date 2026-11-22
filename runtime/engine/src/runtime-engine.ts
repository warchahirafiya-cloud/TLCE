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
  const states: ModuleLifecycleState[] = ["registered", "initialized", "starting", "ready", "degraded", "stopping", "stop_failed", "stopped", "failed"];
  if (!health || !states.includes(health.state) || typeof health.checkedAt !== "string" ||
      Number.isNaN(Date.parse(health.checkedAt)) ||
      (health.message !== undefined && typeof health.message !== "string")) {
    throw new Error(`Module returned an invalid health report: ${moduleId}`);
  }
  return { ...health };
}

export class RuntimeEngine {
  private readonly active = new Set<string>();
  private readonly operations = new Map<string, Promise<void>>();
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
      await this.runExclusive(registered.manifest.id, () => this.startSingleModule(registered.manifest.id));
    }
  }

  async stopModule(moduleId: string): Promise<void> {
    if (!this.registry.get(moduleId)) throw new Error(`Unknown module: ${moduleId}`);
    await this.runExclusive(moduleId, () => this.stopSingleModule(moduleId));
  }

  async restartModule(moduleId: string): Promise<void> {
    if (!this.registry.get(moduleId)) throw new Error(`Unknown module: ${moduleId}`);
    await this.runExclusive(moduleId, async () => {
      await this.stopSingleModule(moduleId);
      await this.startSingleModule(moduleId);
    });
  }

  /**
   * Serialize lifecycle mutations per module. A rejected operation does not poison
   * the queue; later recovery attempts are allowed to proceed.
   */
  private async runExclusive<T>(moduleId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operations.get(moduleId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    const settled = current.then(() => undefined, () => undefined);
    this.operations.set(moduleId, settled);
    try {
      return await current;
    } finally {
      if (this.operations.get(moduleId) === settled) this.operations.delete(moduleId);
    }
  }

  private async startSingleModule(moduleId: string): Promise<void> {
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);

    const state = this.lifecycleState(moduleId);
    if (this.active.has(moduleId) && (state === "ready" || state === "degraded")) return;
    if (state === "stop_failed") {
      throw new Error(`Cannot start module while previous stop cleanup is unresolved: ${moduleId}`);
    }

    this.states.set(moduleId, "starting");
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
      try {
        await registered.implementation.stop();
        this.states.set(moduleId, "failed");
      } catch {
        this.states.set(moduleId, "stop_failed");
      }
      throw error;
    }
  }

  private async stopSingleModule(moduleId: string): Promise<void> {
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);

    const state = this.lifecycleState(moduleId);
    if (!this.active.has(moduleId) && state !== "stop_failed") return;

    this.states.set(moduleId, "stopping");
    try {
      await registered.implementation.stop();
      this.active.delete(moduleId);
      this.states.set(moduleId, "stopped");
    } catch (error) {
      // A failed stop is not an active/healthy state. Keep it explicitly retryable.
      this.active.delete(moduleId);
      this.states.set(moduleId, "stop_failed");
      throw error;
    }
  }

  async health(moduleId: string): Promise<ModuleHealth> {
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);
    const health = validateHealth(await registered.implementation.health(), moduleId);
    if (this.active.has(moduleId)) {
      if (health.state === "failed" || health.state === "stopped" || health.state === "stop_failed") {
        this.active.delete(moduleId);
        this.states.set(moduleId, health.state);
      } else if (health.state === "ready" || health.state === "degraded") {
        this.states.set(moduleId, health.state);
      }
    }
    return health;
  }

  isActive(moduleId: string): boolean {
    const state = this.states.get(moduleId);
    return this.active.has(moduleId) && (state === "ready" || state === "degraded");
  }

  lifecycleState(moduleId: string): ModuleLifecycleState {
    if (!this.registry.get(moduleId)) throw new Error(`Unknown module: ${moduleId}`);
    return this.states.get(moduleId) ?? "registered";
  }
}

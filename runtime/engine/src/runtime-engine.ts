import type { ModuleContext, ModuleHealth, ModulePermission } from "../../../packages/contracts/src/module";
import { ModuleRegistry } from "./module-registry";

export interface RuntimeOptions {
  requestIdFactory?: () => string;
  permissionPolicy?: (moduleId: string, requested: ReadonlyArray<ModulePermission>) => ReadonlyArray<ModulePermission>;
}

export class RuntimeEngine {
  private readonly active = new Set<string>();
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
    const registered = this.registry.get(moduleId);
    if (!registered) throw new Error(`Unknown module: ${moduleId}`);
    if (this.active.has(moduleId)) return;

    const grantedPermissions = this.permissionPolicy(
      moduleId,
      registered.manifest.requestedPermissions,
    );
    const requested = registered.manifest.requestedPermissions;
    const unauthorized = grantedPermissions.filter((grant) => {
      const request = requested.find((item) => item.resource === grant.resource);
      return !request || grant.actions.some((action) => !request.actions.includes(action));
    });
    if (unauthorized.length) {
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
      // Best-effort cleanup prevents partially initialized modules from being marked active.
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
    if (!this.active.has(moduleId)) return;
    await registered.implementation.stop();
    this.active.delete(moduleId);
  }

  isActive(moduleId: string): boolean {
    return this.active.has(moduleId);
  }
}

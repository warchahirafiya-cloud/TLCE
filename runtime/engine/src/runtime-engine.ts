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
    const context: ModuleContext = {
      moduleId,
      moduleVersion: registered.manifest.version,
      grantedPermissions,
      requestId: this.requestIdFactory(),
    };

    await registered.implementation.initialize(context);
    await registered.implementation.start();
    this.active.add(moduleId);
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

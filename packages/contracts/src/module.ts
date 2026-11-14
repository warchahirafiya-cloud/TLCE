export type ModuleLifecycleState = "registered" | "initialized" | "ready" | "degraded" | "stopped" | "failed";

export interface ModuleDependency {
  moduleId: string;
  versionRange: string;
}

export interface ModulePermission {
  resource: string;
  actions: string[];
}

export interface ModuleManifest {
  id: string;
  displayName: string;
  version: string;
  description: string;
  apiVersion: string;
  entrypoint: string;
  dependencies: ModuleDependency[];
  requestedPermissions: ModulePermission[];
}

export interface ModuleHealth {
  state: ModuleLifecycleState;
  checkedAt: string;
  message?: string;
}

export interface ModuleContext {
  moduleId: string;
  moduleVersion: string;
  grantedPermissions: ReadonlyArray<ModulePermission>;
  requestId: string;
}

export interface TLCEModule {
  initialize(context: ModuleContext): Promise<void>;
  start(): Promise<void>;
  health(): Promise<ModuleHealth>;
  stop(): Promise<void>;
}

import type { ModulePermission } from "../../../packages/contracts/src/module";

export interface AuthorizationRequest {
  granted: ReadonlyArray<ModulePermission>;
  resource: string;
  action: string;
}

/** Deny by default. Wildcards are intentionally unsupported in the first version. */
export function isAuthorized(request: AuthorizationRequest): boolean {
  return request.granted.some(
    (permission) =>
      permission.resource === request.resource &&
      permission.actions.includes(request.action),
  );
}

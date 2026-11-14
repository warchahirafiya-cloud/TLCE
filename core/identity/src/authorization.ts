import type { ModulePermission } from "../../../packages/contracts/src/module";
import type { IdentityPrincipal } from "./identity";

export interface AuthorizationRequest {
  granted: ReadonlyArray<ModulePermission>;
  resource: string;
  action: string;
}

export interface TenantAuthorizationRequest {
  principal?: IdentityPrincipal;
  resourceTenantId: string;
  requiredCapability: string;
}

/** Deny by default. Wildcards are intentionally unsupported in the first version. */
export function isAuthorized(request: AuthorizationRequest): boolean {
  if (!request || typeof request.resource !== "string" || typeof request.action !== "string") return false;
  return request.granted.some(
    (permission) =>
      permission.resource === request.resource &&
      permission.actions.includes(request.action),
  );
}

/** Tenant isolation and explicit capability are both mandatory. */
export function isTenantAuthorized(request: TenantAuthorizationRequest): boolean {
  if (!request?.principal || typeof request.resourceTenantId !== "string" ||
      !request.resourceTenantId || typeof request.requiredCapability !== "string") return false;
  return request.principal.tenantId === request.resourceTenantId &&
    request.principal.capabilities.has(request.requiredCapability);
}

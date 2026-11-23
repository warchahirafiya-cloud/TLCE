import type { ModulePermission } from "../../../packages/contracts/src/module";

export interface AuthorizationRequest {
  granted: ReadonlyArray<ModulePermission>;
  resource: string;
  action: string;
}

const IDENTIFIER = /^[a-z][a-z0-9._:-]{0,127}$/;

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && IDENTIFIER.test(value);
}

/**
 * Deny by default. This is a policy evaluator, not an identity provider:
 * callers must supply grants loaded from a trusted server-side source.
 * Wildcards and malformed permission records are rejected.
 */
export function isAuthorized(request: AuthorizationRequest): boolean {
  if (!request || !validIdentifier(request.resource) ||
      !validIdentifier(request.action) || !Array.isArray(request.granted)) {
    return false;
  }

  for (const permission of request.granted) {
    if (!permission || !validIdentifier(permission.resource) ||
        !Array.isArray(permission.actions) ||
        !permission.actions.every(validIdentifier)) {
      return false;
    }
  }

  return request.granted.some(
    (permission) =>
      permission.resource === request.resource &&
      permission.actions.includes(request.action),
  );
}

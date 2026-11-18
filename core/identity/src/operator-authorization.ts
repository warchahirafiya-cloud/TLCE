import type { ModulePermission } from "../../../packages/contracts/src/module.js";

export type OperatorRole = "viewer" | "operator" | "maintainer" | "security_admin";

export interface OperatorAuthorizationRequest {
  roles: ReadonlyArray<OperatorRole>;
  resource: string;
  action: string;
  /** When supplied, the requested module must be inside the operator's explicit scope. */
  moduleId?: string;
  allowedModuleIds?: ReadonlyArray<string>;
}

const ROLE_PERMISSIONS: Readonly<Record<OperatorRole, ReadonlyArray<ModulePermission>>> = {
  viewer: [
    { resource: "control-plane.overview", actions: ["read"] },
    { resource: "modules.registry", actions: ["read"] },
    { resource: "audit.records", actions: ["read"] },
  ],
  operator: [
    { resource: "control-plane.overview", actions: ["read"] },
    { resource: "modules.registry", actions: ["read"] },
    { resource: "audit.records", actions: ["read"] },
    { resource: "modules.lifecycle", actions: ["start", "stop"] },
  ],
  maintainer: [
    { resource: "control-plane.overview", actions: ["read"] },
    { resource: "modules.registry", actions: ["read"] },
    { resource: "audit.records", actions: ["read"] },
    { resource: "modules.lifecycle", actions: ["start", "stop"] },
    { resource: "access.grants", actions: ["read", "write"] },
    { resource: "security.policy", actions: ["read"] },
  ],
  security_admin: [
    { resource: "control-plane.overview", actions: ["read"] },
    { resource: "modules.registry", actions: ["read"] },
    { resource: "audit.records", actions: ["read"] },
    { resource: "access.grants", actions: ["read", "write"] },
    { resource: "security.policy", actions: ["read", "write"] },
  ],
};

/** Expand roles into explicit permissions. Unknown roles are rejected; no wildcard grants exist. */
export function permissionsForOperatorRoles(roles: ReadonlyArray<OperatorRole>): ReadonlyArray<ModulePermission> {
  const permissions = new Map<string, Set<string>>();
  for (const role of roles) {
    const grants = ROLE_PERMISSIONS[role];
    if (!grants) throw new Error("Unknown TLCE operator role");
    for (const grant of grants) {
      const actions = permissions.get(grant.resource) ?? new Set<string>();
      for (const action of grant.actions) actions.add(action);
      permissions.set(grant.resource, actions);
    }
  }
  return Object.freeze([...permissions].map(([resource, actions]) =>
    Object.freeze({ resource, actions: Object.freeze([...actions]) as unknown as string[] }),
  ));
}

/** Authorization only. The roles and scope MUST come from a server-verified identity session. */
export function isOperatorAuthorized(request: OperatorAuthorizationRequest): boolean {
  if (!Array.isArray(request.roles) || request.roles.length === 0) return false;
  if (request.moduleId !== undefined &&
      (!Array.isArray(request.allowedModuleIds) || !request.allowedModuleIds.includes(request.moduleId))) {
    return false;
  }
  let permissions: ReadonlyArray<ModulePermission>;
  try {
    permissions = permissionsForOperatorRoles(request.roles);
  } catch {
    return false;
  }
  return permissions.some((permission) =>
    permission.resource === request.resource && permission.actions.includes(request.action),
  );
}

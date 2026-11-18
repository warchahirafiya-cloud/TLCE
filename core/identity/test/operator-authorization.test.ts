import test from "node:test";
import assert from "node:assert/strict";
import { isOperatorAuthorized, permissionsForOperatorRoles } from "../src/operator-authorization";

test("viewer is read-only and cannot mutate lifecycle or security policy", () => {
  assert.equal(isOperatorAuthorized({ roles: ["viewer"], resource: "control-plane.overview", action: "read" }), true);
  assert.equal(isOperatorAuthorized({ roles: ["viewer"], resource: "modules.lifecycle", action: "stop" }), false);
  assert.equal(isOperatorAuthorized({ roles: ["viewer"], resource: "security.policy", action: "write" }), false);
});

test("operator can manage module lifecycle but cannot edit grants", () => {
  assert.equal(isOperatorAuthorized({ roles: ["operator"], resource: "modules.lifecycle", action: "start" }), true);
  assert.equal(isOperatorAuthorized({ roles: ["operator"], resource: "access.grants", action: "write" }), false);
});

test("maintainer and security administrator have distinct explicit capabilities", () => {
  assert.equal(isOperatorAuthorized({ roles: ["maintainer"], resource: "security.policy", action: "write" }), false);
  assert.equal(isOperatorAuthorized({ roles: ["security_admin"], resource: "security.policy", action: "write" }), true);
  assert.equal(isOperatorAuthorized({ roles: ["security_admin"], resource: "modules.lifecycle", action: "stop" }), false);
});

test("denies empty, unknown, and out-of-scope requests", () => {
  assert.equal(isOperatorAuthorized({ roles: [], resource: "modules.registry", action: "read" }), false);
  assert.equal(isOperatorAuthorized({ roles: ["viewer"], resource: "modules.registry", action: "read", moduleId: "quest-pulse", allowedModuleIds: [] }), false);
  assert.equal(isOperatorAuthorized({ roles: ["viewer"], resource: "modules.registry", action: "read", moduleId: "quest-pulse", allowedModuleIds: ["quest-pulse"] }), true);
  assert.equal(isOperatorAuthorized({ roles: ["owner" as never], resource: "everything", action: "*" }), false);
});

test("role expansion has no wildcard permission", () => {
  const permissions = permissionsForOperatorRoles(["maintainer"]);
  assert.equal(permissions.some((permission) => permission.resource === "*" || permission.actions.includes("*")), false);
});

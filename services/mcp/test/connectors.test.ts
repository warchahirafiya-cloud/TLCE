import test from "node:test";
import assert from "node:assert/strict";
import { authorizeConnectorInvocation, validateConnectorRegistration, type ConnectorGrant, type ConnectorRegistration } from "../src/connectors.js";

const connector: ConnectorRegistration = {
  id: "google-drive-main",
  provider: "google-drive",
  displayName: "Google Drive",
  status: "enabled",
  oauthIssuer: new URL("https://accounts.google.com"),
  clientId: "tlce-google-client",
  clientSecretRef: "vault://tlce/connectors/google-drive",
  redirectUri: new URL("https://tlce.example.test/oauth/callback/google"),
  requestedScopes: ["drive.file"],
  createdAt: "2026-11-14T00:00:00.000Z"
};
const grant: ConnectorGrant = {
  connectorId: connector.id,
  tenantId: "tenant-a",
  principalId: "user-a",
  operations: ["read"],
  resourcePatterns: ["files/owned/"],
  expiresAt: "2030-01-01T00:00:00.000Z",
  approvedBy: "admin-a",
  approvedAt: "2026-11-14T00:00:00.000Z"
};
const request = {
  connectorId: connector.id,
  tenantId: "tenant-a",
  principalId: "user-a",
  operation: "read" as const,
  resource: "files/owned/report.pdf",
  now: new Date("2026-11-14T00:00:00.000Z")
};

test("new connector registrations cannot be enabled before approval", () => {
  assert.throws(() => validateConnectorRegistration({ ...connector, status: "enabled" }), /pending approval or disabled/);
});

test("connector OAuth endpoints must use HTTPS", () => {
  assert.throws(() => validateConnectorRegistration({ ...connector, status: "disabled", redirectUri: new URL("http://localhost/callback") }), /must use HTTPS/);
});

test("authorization permits only a matching tenant, principal, operation and resource", () => {
  assert.deepEqual(authorizeConnectorInvocation([connector], [grant], request), { allowed: true, reason: "grant-match" });
});

test("authorization denies cross-tenant and cross-principal access", () => {
  assert.equal(authorizeConnectorInvocation([connector], [grant], { ...request, tenantId: "tenant-b" }).allowed, false);
  assert.equal(authorizeConnectorInvocation([connector], [grant], { ...request, principalId: "user-b" }).allowed, false);
});

test("authorization denies write operations and resources outside the grant", () => {
  assert.deepEqual(authorizeConnectorInvocation([connector], [grant], { ...request, operation: "write" }), { allowed: false, reason: "operation-not-granted" });
  assert.deepEqual(authorizeConnectorInvocation([connector], [grant], { ...request, resource: "files/shared/secret.pdf" }), { allowed: false, reason: "resource-not-granted" });
});

test("authorization denies wildcard access", () => {
  const wildcardGrant = { ...grant, resourcePatterns: ["*"] };
  assert.deepEqual(authorizeConnectorInvocation([connector], [wildcardGrant], request), { allowed: false, reason: "resource-not-granted" });
});

test("authorization denies pending connectors and expired grants", () => {
  assert.equal(authorizeConnectorInvocation([{ ...connector, status: "pending-approval" }], [grant], request).allowed, false);
  assert.deepEqual(authorizeConnectorInvocation([connector], [{ ...grant, expiresAt: "2020-01-01T00:00:00.000Z" }], request), { allowed: false, reason: "grant-expired" });
});

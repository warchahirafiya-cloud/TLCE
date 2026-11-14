import assert from "node:assert/strict";
import test from "node:test";
import type { IntegrationGrant, ProviderDescriptor } from "../src/contracts.js";
import { authorizeIntegrationOperation } from "../src/policy.js";

const provider: ProviderDescriptor = {
  id: "drive-provider",
  name: "Drive Provider",
  origin: "https://drive.example",
  category: "storage",
  riskClass: "high",
  lifecycle: "enabled",
  connectionVerified: true,
  enabledOperations: ["files.list", "files.create", "payments.transfer"],
};
const grant: IntegrationGrant = {
  tenantId: "tenant-a",
  principalId: "user-a",
  providerId: "drive-provider",
  resourcePatterns: ["folder/project/*"],
  permissions: ["read", "write", "financial"],
  operations: ["files.list", "files.create", "payments.transfer"],
};

const request = {
  tenantId: "tenant-a",
  principalId: "user-a",
  providerId: "drive-provider",
  resource: "folder/project/file-1",
  operation: "files.list",
  permission: "read" as const,
  now: 100,
};

test("allows an exact tenant/principal/resource-scoped grant", () => {
  assert.deepEqual(
    authorizeIntegrationOperation(provider, grant, request),
    { allowed: true, reason: "allowed" },
  );
});

test("denies unknown providers and missing grants", () => {
  assert.equal(authorizeIntegrationOperation(undefined, grant, request).reason, "provider_not_enabled");
  assert.equal(authorizeIntegrationOperation(provider, undefined, request).reason, "grant_missing");
});

test("denies cross-tenant and out-of-resource requests", () => {
  assert.equal(authorizeIntegrationOperation(provider, grant, { ...request, tenantId: "tenant-b" }).reason, "scope_mismatch");
  assert.equal(authorizeIntegrationOperation(provider, grant, { ...request, resource: "folder/private/file" }).reason, "scope_mismatch");
});

test("denies expired and revoked grants", () => {
  assert.equal(authorizeIntegrationOperation(provider, { ...grant, expiresAt: 100 }, request).reason, "grant_expired");
  assert.equal(authorizeIntegrationOperation(provider, { ...grant, revoked: true }, request).reason, "grant_revoked");
});

test("financial actions require separate owner confirmation", () => {
  const financial = { ...request, operation: "payments.transfer", permission: "financial" as const };
  assert.equal(authorizeIntegrationOperation(provider, grant, financial).reason, "owner_confirmation_required");
  assert.equal(authorizeIntegrationOperation(provider, grant, { ...financial, ownerConfirmed: true }).allowed, true);
});

test("denies operations not enabled for the provider", () => {
  assert.equal(authorizeIntegrationOperation(provider, grant, { ...request, operation: "files.delete" }).reason, "operation_not_enabled");
});

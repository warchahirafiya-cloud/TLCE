import assert from "node:assert/strict";
import test from "node:test";
import type { IntegrationGrant, ProviderDescriptor } from "../src/contracts.js";
import type { IntegrationAuditSink, ProviderAdapter } from "../src/adapter.js";
import { IntegrationAuthorizationError, IntegrationGateway } from "../src/gateway.js";

const provider: ProviderDescriptor = {
  id: "sample-provider",
  name: "Sample",
  origin: "https://sample.example",
  category: "storage",
  riskClass: "medium",
  lifecycle: "enabled",
  connectionVerified: true,
  enabledOperations: ["items.read", "payments.send"],
};
const grant: IntegrationGrant = {
  tenantId: "tenant-1",
  principalId: "user-1",
  providerId: "sample-provider",
  resourcePatterns: ["items/*", "payments/*"],
  permissions: ["read", "financial"],
  operations: ["items.read", "payments.send"],
};

function setup(shouldFail = false) {
  const events: Array<Record<string, unknown>> = [];
  let executions = 0;
  const audit: IntegrationAuditSink = {
    async append(event) { events.push(event); },
  };
  const adapter: ProviderAdapter = {
    providerId: "sample-provider",
    operations: [
      { name: "items.read", permission: "read", riskClass: "low", financial: false },
      { name: "payments.send", permission: "financial", riskClass: "critical", financial: true },
    ],
    async healthCheck() { return { healthy: true, checkedAt: 1 }; },
    async execute(operation) {
      executions += 1;
      if (shouldFail) throw new Error("provider failed");
      return { operation, ok: true };
    },
  };
  const gateway = new IntegrationGateway({
    async getProvider() { return provider; },
    async getGrant() { return grant; },
    async getAdapter() { return adapter; },
    audit,
  });
  return { gateway, events, get executions() { return executions; } };
}

const base = {
  tenantId: "tenant-1",
  principalId: "user-1",
  providerId: "sample-provider",
  resource: "items/123",
  operation: "items.read",
  permission: "read" as const,
  correlationId: "trace-123",
  input: { limit: 5 },
};

test("executes allowed operation and writes audit trail", async () => {
  const state = setup();
  const result = await state.gateway.execute(base);
  assert.deepEqual(result, { operation: "items.read", ok: true });
  assert.equal(state.executions, 1);
  assert.deepEqual(state.events.map((event) => event.outcome), ["allowed", "succeeded"]);
  assert.notEqual(state.events[0].eventId, state.events[1].eventId);
});

test("denies out-of-scope requests before adapter execution", async () => {
  const state = setup();
  await assert.rejects(
    () => state.gateway.execute({ ...base, resource: "private/secret" }),
    (error) => error instanceof IntegrationAuthorizationError,
  );
  assert.equal(state.executions, 0);
  assert.equal(state.events[0].outcome, "denied");
});

test("requires owner confirmation for financial operations", async () => {
  const state = setup();
  await assert.rejects(() => state.gateway.execute({
    ...base,
    resource: "payments/123",
    operation: "payments.send",
    permission: "financial",
  }));
  assert.equal(state.executions, 0);
});

test("records provider execution failures", async () => {
  const state = setup(true);
  await assert.rejects(() => state.gateway.execute(base), /provider failed/);
  assert.equal(state.events.at(-1)?.outcome, "failed");
});

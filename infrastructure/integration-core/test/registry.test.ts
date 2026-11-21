import test from "node:test";
import assert from "node:assert/strict";
import { IntegrationRegistry } from "../registry.js";
import type { IntegrationCoreConfig } from "../contracts.js";
const emptyConfig: IntegrationCoreConfig = {
  search: { publicProvidersEnabled: true, braveKeyConfigured: false },
  llm7: { apiKeyConfigured: false, securityPolicyConfigured: false },
  gateway: { identityProviderConfigured: false, sharedRateLimiterConfigured: false },
};
test("registry exposes capability metadata without secret values", () => {
  const entries = new IntegrationRegistry(emptyConfig).list();
  assert.deepEqual(entries.map((entry) => entry.id), ["search", "llm7", "api-gateway"]);
  assert.equal(entries[0]?.enabled, true);
  assert.equal(entries[1]?.enabled, false);
  assert.equal(JSON.stringify(entries).includes("API_KEY"), false);
});
test("diagnostics remain partial when no live probes have run", async () => {
  const result = await new IntegrationRegistry(emptyConfig).diagnostics();
  assert.equal(result.overall, "partial");
  assert.equal(result.integrations[0]?.health, "not_checked");
});
test("probe failures are isolated and exception details are hidden", async () => {
  const config: IntegrationCoreConfig = {
    search: { publicProvidersEnabled: true, braveKeyConfigured: false },
    llm7: { apiKeyConfigured: true, securityPolicyConfigured: true },
    gateway: { identityProviderConfigured: true, sharedRateLimiterConfigured: true },
  };
  const result = await new IntegrationRegistry(config, {
    search: { check: async () => true },
    llm7: { check: async () => { throw new Error("sensitive upstream detail"); } },
    "api-gateway": { check: async () => false },
  }).diagnostics();
  assert.equal(result.integrations[0]?.health, "healthy");
  assert.equal(result.integrations[1]?.health, "unavailable");
  assert.equal(result.integrations[2]?.health, "degraded");
  assert.equal(JSON.stringify(result).includes("sensitive upstream detail"), false);
});
test("disabled integrations are never probed", async () => {
  let called = false;
  const result = await new IntegrationRegistry(emptyConfig, { llm7: { check: async () => { called = true; return true; } } }).diagnostics();
  assert.equal(called, false);
  assert.equal(result.integrations[1]?.health, "unavailable");
});

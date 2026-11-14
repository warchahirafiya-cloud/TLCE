import assert from "node:assert/strict";
import test from "node:test";
import type {
  IntegrationConnectionRepository,
  IntegrationGrantRepository,
  IntegrationPersistence,
  ProviderRegistryRepository,
} from "../src/persistence.js";

test("persistence ports expose tenant-scoped repository boundaries", () => {
  const names: Array<keyof IntegrationPersistence> = [
    "connections", "grants", "providers", "oauthTransactions",
  ];
  assert.deepEqual(names, ["connections", "grants", "providers", "oauthTransactions"]);
  const methods: Array<keyof IntegrationConnectionRepository | keyof IntegrationGrantRepository | keyof ProviderRegistryRepository> = [
    "get", "create", "transition", "list", "put", "revoke",
  ];
  assert.equal(new Set(methods).size, methods.length);
});

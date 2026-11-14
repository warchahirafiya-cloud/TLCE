import assert from "node:assert/strict";
import test from "node:test";
import type { ProviderDescriptor } from "../src/contracts.js";
import { validateProviderRegistry } from "../src/registry.js";

const base: ProviderDescriptor = {
  id: "provider-one",
  name: "Provider One",
  origin: "https://provider.example",
  category: "research",
  riskClass: "medium",
  lifecycle: "catalogued",
  connectionVerified: false,
  enabledOperations: [],
};

test("accepts a well-formed catalogue-only provider", () => {
  assert.deepEqual(validateProviderRegistry([base]), []);
});

test("rejects duplicate IDs and unsafe origins", () => {
  const errors = validateProviderRegistry([
    base,
    { ...base, origin: "http://provider.example" },
  ]);
  assert.ok(errors.some((error) => error.includes("duplicate provider id")));
  assert.ok(errors.some((error) => error.includes("credential-free HTTPS")));
});

test("rejects a catalogue entry falsely marked as connected", () => {
  const errors = validateProviderRegistry([{ ...base, connectionVerified: true }]);
  assert.ok(errors.some((error) => error.includes("cannot be connected or enabled")));
});

test("requires verified connection before enablement", () => {
  const errors = validateProviderRegistry([{ ...base, lifecycle: "enabled" }]);
  assert.ok(errors.some((error) => error.includes("must have a verified connection")));
});

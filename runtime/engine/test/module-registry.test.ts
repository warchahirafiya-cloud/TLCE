import test from "node:test";
import assert from "node:assert/strict";
import { ModuleRegistry } from "../src/module-registry";
import type { ModuleManifest, TLCEModule } from "../../../packages/contracts/src/module";

const implementation: TLCEModule = {
  async initialize() {},
  async start() {},
  async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
  async stop() {},
};

const manifest: ModuleManifest = {
  id: "quest-pulse",
  displayName: "QuestPulse",
  version: "1.0.0",
  description: "Internal TLCE module",
  apiVersion: "1",
  entrypoint: "./src/index.ts",
  dependencies: [],
  requestedPermissions: [],
};

test("registers and retrieves a valid module", () => {
  const registry = new ModuleRegistry();
  registry.register(manifest, implementation);
  assert.equal(registry.get("quest-pulse")?.manifest.version, "1.0.0");
  assert.equal(registry.list().length, 1);
});

test("rejects duplicate module identifiers", () => {
  const registry = new ModuleRegistry();
  registry.register(manifest, implementation);
  assert.throws(() => registry.register(manifest, implementation), /already registered/);
});

test("rejects malformed semantic versions", () => {
  const registry = new ModuleRegistry();
  assert.throws(
    () => registry.register({ ...manifest, version: "v1" }, implementation),
    /Invalid module version/,
  );
});

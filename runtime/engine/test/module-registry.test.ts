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


test("resolves dependencies before the requested module", () => {
  const registry = new ModuleRegistry();
  const dependency = { ...manifest, id: "tlce-core", displayName: "TLCE Core" };
  const application = {
    ...manifest,
    id: "quest-pulse",
    dependencies: [{ moduleId: "tlce-core", versionRange: "1.0.0" }],
  };
  registry.register(application, implementation);
  registry.register(dependency, implementation);
  assert.deepEqual(
    registry.resolveStartOrder("quest-pulse").map((item) => item.manifest.id),
    ["tlce-core", "quest-pulse"],
  );
});

test("rejects missing dependencies and dependency cycles", () => {
  const missingRegistry = new ModuleRegistry();
  missingRegistry.register({
    ...manifest,
    dependencies: [{ moduleId: "tlce-core", versionRange: "*" }],
  }, implementation);
  assert.throws(() => missingRegistry.resolveStartOrder("quest-pulse"), /Missing module dependency/);

  const cyclicRegistry = new ModuleRegistry();
  cyclicRegistry.register({
    ...manifest,
    dependencies: [{ moduleId: "tlce-core", versionRange: "*" }],
  }, implementation);
  cyclicRegistry.register({
    ...manifest,
    id: "tlce-core",
    displayName: "TLCE Core",
    dependencies: [{ moduleId: "quest-pulse", versionRange: "*" }],
  }, implementation);
  assert.throws(() => cyclicRegistry.resolveStartOrder("quest-pulse"), /dependency cycle/);
});

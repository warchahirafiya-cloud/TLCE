import test from "node:test";
import assert from "node:assert/strict";
import { ModuleRegistry } from "../src/module-registry";
import { RuntimeEngine } from "../src/runtime-engine";
import type { ModuleContext, ModuleManifest, TLCEModule } from "../../../packages/contracts/src/module";

const manifest: ModuleManifest = {
  id: "quest-pulse",
  displayName: "QuestPulse",
  version: "1.0.0",
  description: "Internal TLCE module",
  apiVersion: "1",
  entrypoint: "./src/index.ts",
  dependencies: [],
  requestedPermissions: [{ resource: "profile", actions: ["read"] }],
};

test("starts, reports health, and stops a module", async () => {
  const calls: string[] = [];
  let captured: ModuleContext | undefined;
  const module: TLCEModule = {
    async initialize(context) { calls.push("initialize"); captured = context; },
    async start() { calls.push("start"); },
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() { calls.push("stop"); },
  };
  const registry = new ModuleRegistry();
  registry.register(manifest, module);
  const engine = new RuntimeEngine(registry, { requestIdFactory: () => "test-request" });

  await engine.startModule("quest-pulse");
  assert.equal(engine.isActive("quest-pulse"), true);
  assert.deepEqual(calls, ["initialize", "start"]);
  assert.equal(captured?.requestId, "test-request");
  assert.deepEqual(captured?.grantedPermissions, []);
  assert.equal((await engine.health("quest-pulse")).state, "ready");

  await engine.stopModule("quest-pulse");
  assert.equal(engine.isActive("quest-pulse"), false);
  assert.deepEqual(calls, ["initialize", "start", "stop"]);
});

test("rejects unknown modules", async () => {
  const engine = new RuntimeEngine(new ModuleRegistry());
  await assert.rejects(() => engine.startModule("missing"), /Unknown module/);
});

test("rejects permissions that the module did not request", async () => {
  const registry = new ModuleRegistry();
  const module: TLCEModule = {
    async initialize() {},
    async start() {},
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() {},
  };
  registry.register(manifest, module);
  const engine = new RuntimeEngine(registry, {
    permissionPolicy: () => [{ resource: "billing", actions: ["read"] }],
  });
  await assert.rejects(() => engine.startModule("quest-pulse"), /not requested/);
  assert.equal(engine.isActive("quest-pulse"), false);
});

test("cleans up a module when startup fails", async () => {
  const calls: string[] = [];
  const registry = new ModuleRegistry();
  const module: TLCEModule = {
    async initialize() { calls.push("initialize"); },
    async start() { calls.push("start"); throw new Error("startup failed"); },
    async health() { return { state: "failed", checkedAt: new Date(0).toISOString() }; },
    async stop() { calls.push("stop"); },
  };
  registry.register({ ...manifest, requestedPermissions: [] }, module);
  const engine = new RuntimeEngine(registry);
  await assert.rejects(() => engine.startModule("quest-pulse"), /startup failed/);
  assert.deepEqual(calls, ["initialize", "start", "stop"]);
  assert.equal(engine.isActive("quest-pulse"), false);
});

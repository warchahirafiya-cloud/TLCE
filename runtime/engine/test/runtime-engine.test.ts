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
  assert.equal(engine.lifecycleState("quest-pulse"), "ready");
  assert.deepEqual(calls, ["initialize", "start"]);
  assert.equal(captured?.requestId, "test-request");
  assert.deepEqual(captured?.grantedPermissions, []);
  assert.equal(Object.isFrozen(captured), true);
  assert.equal(Object.isFrozen(captured?.grantedPermissions), true);
  assert.equal((await engine.health("quest-pulse")).state, "ready");

  await engine.stopModule("quest-pulse");
  assert.equal(engine.isActive("quest-pulse"), false);
  assert.equal(engine.lifecycleState("quest-pulse"), "stopped");
  assert.deepEqual(calls, ["initialize", "start", "stop"]);
});

test("rejects unknown modules", async () => {
  const engine = new RuntimeEngine(new ModuleRegistry());
  await assert.rejects(() => engine.startModule("missing"), /Unknown module/);
});

test("rejects permissions that the module did not request", async () => {
  const registry = new ModuleRegistry();
  const module: TLCEModule = {
    async initialize() {}, async start() {},
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() {},
  };
  registry.register(manifest, module);
  const engine = new RuntimeEngine(registry, {
    permissionPolicy: () => [{ resource: "billing", actions: ["read"] }],
  });
  await assert.rejects(() => engine.startModule("quest-pulse"), /not requested/);
  assert.equal(engine.isActive("quest-pulse"), false);
  assert.equal(engine.lifecycleState("quest-pulse"), "failed");
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

test("coalesces concurrent starts into one lifecycle execution", async () => {
  let initializeCount = 0, startCount = 0;
  let releaseStart!: () => void;
  const gate = new Promise<void>((resolve) => { releaseStart = resolve; });
  const registry = new ModuleRegistry();
  registry.register({ ...manifest, requestedPermissions: [] }, {
    async initialize() { initializeCount += 1; },
    async start() { startCount += 1; await gate; },
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() {},
  });
  const engine = new RuntimeEngine(registry);
  const first = engine.startModule("quest-pulse"), second = engine.startModule("quest-pulse");
  await Promise.resolve();
  releaseStart();
  await Promise.all([first, second]);
  assert.equal(initializeCount, 1);
  assert.equal(startCount, 1);
  assert.equal(engine.isActive("quest-pulse"), true);
});

test("serializes concurrent stops into one stop call", async () => {
  let stopCount = 0, releaseStop!: () => void;
  const gate = new Promise<void>((resolve) => { releaseStop = resolve; });
  const registry = new ModuleRegistry();
  registry.register({ ...manifest, requestedPermissions: [] }, {
    async initialize() {}, async start() {},
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() { stopCount += 1; await gate; },
  });
  const engine = new RuntimeEngine(registry);
  await engine.startModule("quest-pulse");
  const first = engine.stopModule("quest-pulse"), second = engine.stopModule("quest-pulse");
  await Promise.resolve();
  releaseStop();
  await Promise.all([first, second]);
  assert.equal(stopCount, 1);
  assert.equal(engine.isActive("quest-pulse"), false);
});

test("validates module health reports", async () => {
  const registry = new ModuleRegistry();
  registry.register({ ...manifest, requestedPermissions: [] }, {
    async initialize() {}, async start() {},
    async health() { return { state: "ready", checkedAt: "not-a-date" }; },
    async stop() {},
  });
  const engine = new RuntimeEngine(registry);
  await assert.rejects(() => engine.health("quest-pulse"), /invalid health report/);
});

test("rejects duplicate or empty permission grants", async () => {
  const registry = new ModuleRegistry();
  registry.register(manifest, {
    async initialize() {}, async start() {},
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() {},
  });
  const engine = new RuntimeEngine(registry, {
    permissionPolicy: () => [{ resource: "profile", actions: ["read", "read"] }],
  });
  await assert.rejects(() => engine.startModule("quest-pulse"), /not requested/);
});

test("rejects an empty request identifier", async () => {
  const registry = new ModuleRegistry();
  registry.register({ ...manifest, requestedPermissions: [] }, {
    async initialize() {}, async start() {},
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() {},
  });
  const engine = new RuntimeEngine(registry, { requestIdFactory: () => " " });
  await assert.rejects(() => engine.startModule("quest-pulse"), /non-empty string/);
});


test("marks a failed stop inactive and allows an explicit stop retry", async () => {
  let stopCount = 0;
  const registry = new ModuleRegistry();
  registry.register({ ...manifest, requestedPermissions: [] }, {
    async initialize() {}, async start() {},
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() {
      stopCount += 1;
      if (stopCount === 1) throw new Error("stop failed");
    },
  });
  const engine = new RuntimeEngine(registry);
  await engine.startModule("quest-pulse");
  await assert.rejects(() => engine.stopModule("quest-pulse"), /stop failed/);
  assert.equal(engine.isActive("quest-pulse"), false);
  assert.equal(engine.lifecycleState("quest-pulse"), "stop_failed");
  await assert.rejects(() => engine.startModule("quest-pulse"), /cleanup is unresolved/);
  await engine.stopModule("quest-pulse");
  assert.equal(engine.lifecycleState("quest-pulse"), "stopped");
  assert.equal(stopCount, 2);
});

test("start requested during stop waits and performs a fresh start", async () => {
  let stopCount = 0;
  let startCount = 0;
  let releaseStop!: () => void;
  const stopGate = new Promise<void>((resolve) => { releaseStop = resolve; });
  const registry = new ModuleRegistry();
  registry.register({ ...manifest, requestedPermissions: [] }, {
    async initialize() {},
    async start() { startCount += 1; },
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() { stopCount += 1; await stopGate; },
  });
  const engine = new RuntimeEngine(registry);
  await engine.startModule("quest-pulse");
  const stopping = engine.stopModule("quest-pulse");
  const starting = engine.startModule("quest-pulse");
  await Promise.resolve();
  assert.equal(engine.lifecycleState("quest-pulse"), "stopping");
  releaseStop();
  await Promise.all([stopping, starting]);
  assert.equal(stopCount, 1);
  assert.equal(startCount, 2);
  assert.equal(engine.isActive("quest-pulse"), true);
  assert.equal(engine.lifecycleState("quest-pulse"), "ready");
});

test("restart performs stop then a complete new start", async () => {
  const calls: string[] = [];
  const registry = new ModuleRegistry();
  registry.register({ ...manifest, requestedPermissions: [] }, {
    async initialize() { calls.push("initialize"); },
    async start() { calls.push("start"); },
    async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
    async stop() { calls.push("stop"); },
  });
  const engine = new RuntimeEngine(registry);
  await engine.startModule("quest-pulse");
  await engine.restartModule("quest-pulse");
  assert.deepEqual(calls, ["initialize", "start", "stop", "initialize", "start"]);
  assert.equal(engine.isActive("quest-pulse"), true);
  assert.equal(engine.lifecycleState("quest-pulse"), "ready");
});

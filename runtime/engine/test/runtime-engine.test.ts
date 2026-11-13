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

import assert from "node:assert/strict";
import { test } from "node:test";
import { ModuleRegistry } from "../../../runtime/engine/src/module-registry.js";
import { RuntimeEngine } from "../../../runtime/engine/src/runtime-engine.js";
import type { ModuleContext } from "../../../packages/contracts/src/module.js";
import { createQuestPulseModule, questPulseManifest } from "../src/index.js";

const context: ModuleContext = Object.freeze({
  moduleId: "questpulse",
  moduleVersion: "0.1.0",
  grantedPermissions: Object.freeze([]),
  requestId: "qp-test-request",
});

test("declares QuestPulse as an internal TLCE module with no unreviewed permissions", () => {
  assert.equal(questPulseManifest.id, "questpulse");
  assert.equal(questPulseManifest.displayName, "QuestPulse");
  assert.equal(questPulseManifest.entrypoint, "modules/questpulse/src/index.ts");
  assert.deepEqual(questPulseManifest.dependencies, []);
  assert.deepEqual(questPulseManifest.requestedPermissions, []);
});

test("rejects initialization with a mismatched TLCE module identity", async () => {
  const module = createQuestPulseModule();
  await assert.rejects(
    () => module.initialize({ ...context, moduleId: "questpulse-external" }),
    /incompatible TLCE module context/,
  );
});

test("rejects permissions until QuestPulse capabilities have been reviewed", async () => {
  const module = createQuestPulseModule();
  await assert.rejects(
    () => module.initialize({
      ...context,
      grantedPermissions: [{ resource: "events", actions: ["publish"] }],
    }),
    /does not accept permissions/,
  );
});

test("cannot start before TLCE initializes the module", async () => {
  const module = createQuestPulseModule();
  await assert.rejects(() => module.start(), /must be initialized by TLCE/);
});

test("runs through the shared TLCE Runtime Engine lifecycle", async () => {
  const registry = new ModuleRegistry();
  const module = createQuestPulseModule();
  registry.register(questPulseManifest, module);
  const runtime = new RuntimeEngine(registry, { requestIdFactory: () => "qp-runtime-test" });

  assert.equal(runtime.lifecycleState("questpulse"), "registered");
  await runtime.startModule("questpulse");
  assert.equal(runtime.isActive("questpulse"), true);
  assert.equal(runtime.lifecycleState("questpulse"), "ready");
  assert.equal((await runtime.health("questpulse")).state, "ready");

  await runtime.stopModule("questpulse");
  assert.equal(runtime.isActive("questpulse"), false);
  assert.equal(runtime.lifecycleState("questpulse"), "stopped");
});

test("health reports that product features are not yet integrated", async () => {
  const module = createQuestPulseModule();
  const health = await module.health();
  assert.equal(health.state, "registered");
  assert.match(health.message ?? "", /not yet integrated|awaiting reviewed source integration/);
  assert.equal(Number.isNaN(Date.parse(health.checkedAt)), false);
});

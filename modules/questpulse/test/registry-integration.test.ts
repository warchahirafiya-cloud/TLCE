import assert from "node:assert/strict";
import test from "node:test";
import { ModuleRegistry } from "../../../runtime/engine/src/module-registry.js";
import { RuntimeEngine } from "../../../runtime/engine/src/runtime-engine.js";
import { registerQuestPulse } from "../src/register.js";

test("registers QuestPulse with TLCE registry and starts it through host Runtime Engine", async () => {
  const registry = new ModuleRegistry();
  registerQuestPulse(registry);
  assert.equal(registry.get("questpulse")?.manifest.displayName, "QuestPulse");

  const engine = new RuntimeEngine(registry, { requestIdFactory: () => "qp-integration-test" });
  await engine.startModule("questpulse");

  assert.equal(engine.isActive("questpulse"), true);
  assert.equal(engine.lifecycleState("questpulse"), "ready");
  assert.equal((await engine.health("questpulse")).state, "ready");

  await engine.stopModule("questpulse");
  assert.equal(engine.lifecycleState("questpulse"), "stopped");
});

test("prevents registering a second QuestPulse instance", () => {
  const registry = new ModuleRegistry();
  registerQuestPulse(registry);
  assert.throws(() => registerQuestPulse(registry), /already registered/);
});

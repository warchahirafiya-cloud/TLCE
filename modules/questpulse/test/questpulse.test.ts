import assert from "node:assert/strict";
import test from "node:test";
import { questPulseManifest } from "../src/manifest.js";
import { QuestPulseModule } from "../src/index.js";

test("QuestPulse manifest is internal and requests no unapproved permissions", () => {
  assert.equal(questPulseManifest.id, "questpulse");
  assert.equal(questPulseManifest.entrypoint, "modules/questpulse/src/index.ts");
  assert.deepEqual(questPulseManifest.requestedPermissions, []);
});

test("QuestPulse rejects initialization under a different module identity", async () => {
  const module = new QuestPulseModule();
  await assert.rejects(
    module.initialize({
      moduleId: "not-questpulse",
      moduleVersion: "0.1.0",
      grantedPermissions: [],
      requestId: "test-request",
    }),
    /registered TLCE module identity/,
  );
});

test("QuestPulse follows initialize, start, health and stop lifecycle", async () => {
  const module = new QuestPulseModule();
  await module.initialize({
    moduleId: "questpulse",
    moduleVersion: questPulseManifest.version,
    grantedPermissions: [],
    requestId: "test-request",
  });
  await module.start();
  assert.equal((await module.health()).state, "ready");
  await module.stop();
  assert.equal((await module.health()).state, "stopped");
});

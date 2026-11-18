import test from "node:test";
import assert from "node:assert/strict";
import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend.js";
import { MicroFrontendRegistry } from "../src/micro-frontend-registry.js";

const manifest: MicroFrontendManifest = {
  id: "questpulse", displayName: "QuestPulse", version: "0.1.0", apiVersion: "1",
  route: "/questpulse", entrypoint: "/assets/tlce/branches/questpulse/entry.js",
  requestedCapabilities: [], dependencies: [],
};

test("resolves only paths inside the registered Q.P route namespace", () => {
  const registry = new MicroFrontendRegistry();
  registry.register(manifest);
  assert.equal(registry.resolveRoute("/questpulse")?.id, "questpulse");
  assert.equal(registry.resolveRoute("/questpulse/offers")?.id, "questpulse");
  assert.equal(registry.resolveRoute("/questpulse-old"), undefined);
  assert.equal(registry.resolveRoute("/admin"), undefined);
});

test("rejects encoded traversal, malformed encoding, query strings, and backslashes", () => {
  const registry = new MicroFrontendRegistry();
  registry.register(manifest);
  assert.equal(registry.resolveRoute("/questpulse/%2e%2e/admin"), undefined);
  assert.equal(registry.resolveRoute("/questpulse/%E0%A4%A"), undefined);
  assert.equal(registry.resolveRoute("/questpulse?next=/admin"), undefined);
  assert.equal(registry.resolveRoute("/questpulse\\admin"), undefined);
});

test("rejects a manifest entrypoint containing a backslash", () => {
  const registry = new MicroFrontendRegistry();
  assert.throws(
    () => registry.register({ ...manifest, entrypoint: "/assets\\evil.js" }),
    /same-origin absolute asset path/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import type { ModuleManifest, TLCEModule } from "../../../packages/contracts/src/module.js";
import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend.js";
import { ModuleRegistry } from "../src/module-registry.js";
import { MicroFrontendRegistry } from "../src/micro-frontend-registry.js";
import { ProductBranchRegistry } from "../src/product-branch-registry.js";

const moduleManifest: ModuleManifest = {
  id: "questpulse", displayName: "QuestPulse", version: "0.1.0",
  description: "Internal branch", apiVersion: "1",
  entrypoint: "modules/questpulse/src/index.ts", dependencies: [], requestedPermissions: [],
};
const frontendManifest: MicroFrontendManifest = {
  id: "questpulse", displayName: "QuestPulse", version: "0.1.0", apiVersion: "1",
  route: "/questpulse", entrypoint: "/assets/tlce/branches/questpulse/entry.js",
  requestedCapabilities: [], dependencies: [],
};
const implementation: TLCEModule = {
  async initialize() {}, async start() {},
  async health() { return { state: "ready", checkedAt: new Date(0).toISOString() }; },
  async stop() {},
};
function createRegistry() {
  const modules = new ModuleRegistry();
  const frontends = new MicroFrontendRegistry();
  return { modules, frontends, branches: new ProductBranchRegistry(modules, frontends) };
}

test("registers a product branch in both parent registries", () => {
  const { modules, frontends, branches } = createRegistry();
  branches.register({ moduleManifest, frontendManifest, implementation });
  assert.equal(branches.get("questpulse")?.route, "/questpulse");
  assert.equal(modules.get("questpulse")?.manifest.version, "0.1.0");
  assert.equal(frontends.get("questpulse")?.apiVersion, "1");
  assert.deepEqual(branches.resolveRoute("/questpulse/offers"), {
    id: "questpulse", version: "0.1.0", route: "/questpulse", apiVersion: "1",
  });
});

test("rejects inconsistent manifests before mutating either registry", () => {
  const { modules, frontends, branches } = createRegistry();
  assert.throws(() => branches.register({
    moduleManifest,
    frontendManifest: { ...frontendManifest, version: "0.2.0" },
    implementation,
  }), /share id, version, and API version/);
  assert.equal(modules.list().length, 0);
  assert.equal(frontends.list().length, 0);
});

test("rejects duplicate branch ids and route collisions", () => {
  const { branches } = createRegistry();
  branches.register({ moduleManifest, frontendManifest, implementation });
  assert.throws(() => branches.register({ moduleManifest, frontendManifest, implementation }), /already registered/);
  const otherModule = { ...moduleManifest, id: "other-branch", displayName: "Other" };
  const otherFrontend = { ...frontendManifest, id: "other-branch" };
  assert.throws(() => branches.register({
    moduleManifest: otherModule, frontendManifest: otherFrontend, implementation,
  }), /route is already registered/);
});

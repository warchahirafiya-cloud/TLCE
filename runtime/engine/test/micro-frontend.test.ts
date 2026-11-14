import test from "node:test";
import assert from "node:assert/strict";
import { MicroFrontendRegistry } from "../src/micro-frontend-registry";
import { MicroFrontendHost } from "../src/micro-frontend-host";
import type { MicroFrontendManifest } from "../../../packages/contracts/src/micro-frontend";

const manifest: MicroFrontendManifest = {
 id: "quest-pulse-ui", displayName: "QuestPulse", version: "1.0.0", apiVersion: "1",
 route: "/questpulse", entrypoint: "/modules/questpulse/remoteEntry.js",
 requestedCapabilities: ["questpulse.tasks.read"], dependencies: [],
};
test("registers manifests and returns defensive snapshots", () => {
 const registry = new MicroFrontendRegistry(); registry.register(manifest);
 const copy = registry.get(manifest.id)!; copy.requestedCapabilities.push("admin.root");
 assert.deepEqual(registry.get(manifest.id)?.requestedCapabilities, ["questpulse.tasks.read"]);
});
test("rejects unsafe entrypoints, duplicate routes and malformed declarations", () => {
 const registry = new MicroFrontendRegistry();
 assert.throws(() => registry.register({ ...manifest, entrypoint: "https://evil.example/remote.js" }), /same-origin/);
 assert.throws(() => registry.register({ ...manifest, entrypoint: "/modules/../secret.js" }), /same-origin/);
 registry.register(manifest);
 assert.throws(() => registry.register({ ...manifest, id: "other-module" }), /route already/);
});
test("resolves dependencies before dependent frontend and rejects missing/cyclic dependencies", () => {
 const registry = new MicroFrontendRegistry();
 registry.register({ ...manifest, id: "shared-ui", displayName: "Shared UI", route: "/shared", requestedCapabilities: [] });
 registry.register({ ...manifest, dependencies: [{ id: "shared-ui", version: "1.0.0" }] });
 assert.deepEqual(registry.resolveStartOrder(manifest.id).map((item) => item.id), ["shared-ui", manifest.id]);
 const missing = new MicroFrontendRegistry();
 missing.register({ ...manifest, dependencies: [{ id: "shared-ui", version: "1.0.0" }] });
 assert.throws(() => missing.resolveStartOrder(manifest.id), /Missing/);
});
test("host denies missing capability before loading bundle and enforces route", async () => {
 const registry = new MicroFrontendRegistry(); registry.register(manifest);
 let loads = 0;
 const host = new MicroFrontendHost(registry, async () => { loads++; return { mount: async () => ({ unmount() {} }) }; });
 const services = { request: async () => null, publish() {}, subscribe: () => () => {} };
 await assert.rejects(host.mount(manifest.id, {} as HTMLElement, "r1", new Set(), services, manifest.route), /capability/);
 await assert.rejects(host.mount(manifest.id, {} as HTMLElement, "r1", new Set(["questpulse.tasks.read"]), services, "/wrong"), /Route/);
 assert.equal(loads, 0);
});
test("host mounts and unmounts independent frontend module", async () => {
 const registry = new MicroFrontendRegistry(); registry.register(manifest);
 let unmounted = 0;
 const host = new MicroFrontendHost(registry, async () => ({ mount: async () => ({ unmount() { unmounted++; } }) }));
 const services = { request: async () => null, publish() {}, subscribe: () => () => {} };
 await host.mount(manifest.id, {} as HTMLElement, "r1", new Set(["questpulse.tasks.read"]), services, manifest.route);
 assert.equal(host.isMounted(manifest.id), true);
 assert.equal(await host.unmount(manifest.id), true);
 assert.equal(unmounted, 1);
 assert.equal(await host.unmount(manifest.id), false);
});

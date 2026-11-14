import test from "node:test";
import assert from "node:assert/strict";
import { MicroFrontendRegistry } from "../src/micro-frontend-registry";
import { MicroFrontendHost } from "../src/micro-frontend-host";
import type { MicroFrontendManifest, MicroFrontendServices } from "../../../packages/contracts/src/micro-frontend";

const manifest: MicroFrontendManifest = {
 id: "quest-pulse-ui", displayName: "QuestPulse", version: "1.0.0", apiVersion: "1",
 route: "/questpulse", entrypoint: "/modules/questpulse/remoteEntry.js",
 requestedCapabilities: ["questpulse.tasks.read"], dependencies: [],
};
function serviceHarness() {
 const calls: unknown[] = [];
 const services: MicroFrontendServices = {
  async request(input) { calls.push(input); return { ok: true }; },
  publish(name, payload) { calls.push({ name, payload }); },
  subscribe(name) { calls.push({ subscribe: name }); return () => {}; },
 };
 return { services, calls };
}
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
 const { services } = serviceHarness();
 await assert.rejects(host.mount(manifest.id, {} as HTMLElement, "r1", new Set(), services, manifest.route), /capability/);
 await assert.rejects(host.mount(manifest.id, {} as HTMLElement, "r1", new Set(["questpulse.tasks.read"]), services, "/wrong"), /Route/);
 assert.equal(loads, 0);
});
test("host scopes API access to granted capabilities and validates methods and paths", async () => {
 const registry = new MicroFrontendRegistry(); registry.register(manifest);
 const { services, calls } = serviceHarness();
 let exposed: MicroFrontendServices | undefined;
 const host = new MicroFrontendHost(registry, async () => ({ mount: async ({ context }) => {
  exposed = context.services; return { unmount() {} };
 } }));
 await host.mount(manifest.id, {} as HTMLElement, "r1", new Set(["questpulse.tasks.read"]), services, manifest.route);
 await assert.rejects(exposed!.request({ capability: "admin.users.delete", method: "GET", path: "/users" }), /denied/);
 await assert.rejects(exposed!.request({ capability: "questpulse.tasks.read", method: "TRACE", path: "/tasks" }), /method/);
 await assert.rejects(exposed!.request({ capability: "questpulse.tasks.read", method: "GET", path: "/%2e%2e/secret" }), /path/);
 await assert.rejects(exposed!.request({ capability: "questpulse.tasks.read", method: "GET", path: "/%ZZ" }), /path/);
 await exposed!.request({ capability: "questpulse.tasks.read", method: "get", path: "/tasks" });
 assert.deepEqual(calls, [{ capability: "questpulse.tasks.read", method: "GET", path: "/tasks" }]);
});
test("host restricts event namespaces and requires event capabilities", async () => {
 const eventManifest = { ...manifest, requestedCapabilities: ["questpulse.tasks.read", "events.publish", "events.subscribe"] };
 const registry = new MicroFrontendRegistry(); registry.register(eventManifest);
 const { services, calls } = serviceHarness();
 let exposed: MicroFrontendServices | undefined;
 const host = new MicroFrontendHost(registry, async () => ({ mount: async ({ context }) => {
  exposed = context.services; return { unmount() {} };
 } }));
 await host.mount(eventManifest.id, {} as HTMLElement, "r1", new Set(["questpulse.tasks.read", "events.publish", "events.subscribe"]), services, eventManifest.route);
 assert.throws(() => exposed!.publish("other-module.secret", {}), /namespace/);
 exposed!.publish("quest-pulse-ui.task.updated", { id: "1" });
 assert.deepEqual(calls, [{ name: "quest-pulse-ui.task.updated", payload: { id: "1" } }]);
});
test("host prevents concurrent duplicate mounts and unmounts cleanly", async () => {
 const registry = new MicroFrontendRegistry(); registry.register(manifest);
 let release!: () => void;
 const gate = new Promise<void>((resolve) => { release = resolve; });
 const { services } = serviceHarness();
 const host = new MicroFrontendHost(registry, async () => {
  await gate; return { mount: async () => ({ unmount() {} }) };
 });
 const first = host.mount(manifest.id, {} as HTMLElement, "r1", new Set(["questpulse.tasks.read"]), services, manifest.route);
 await Promise.resolve();
 assert.equal(host.isMounting(manifest.id), true);
 await assert.rejects(host.mount(manifest.id, {} as HTMLElement, "r2", new Set(["questpulse.tasks.read"]), services, manifest.route), /already/);
 release(); await first;
 assert.equal(host.isMounted(manifest.id), true);
 assert.equal(await host.unmount(manifest.id), true);
 assert.equal(await host.unmount(manifest.id), false);
});
test("host releases mounting lock when module load fails", async () => {
 const registry = new MicroFrontendRegistry(); registry.register(manifest);
 const { services } = serviceHarness();
 const host = new MicroFrontendHost(registry, async () => { throw new Error("load failed"); });
 await assert.rejects(host.mount(manifest.id, {} as HTMLElement, "r1", new Set(["questpulse.tasks.read"]), services, manifest.route), /load failed/);
 assert.equal(host.isMounting(manifest.id), false);
});

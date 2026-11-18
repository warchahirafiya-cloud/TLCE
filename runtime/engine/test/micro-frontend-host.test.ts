import test from "node:test";
import assert from "node:assert/strict";
import { MicroFrontendRegistry } from "../src/micro-frontend-registry.js";
import { MicroFrontendHost } from "../src/micro-frontend-host.js";
import type { MicroFrontendManifest, MicroFrontendServices } from "../../../packages/contracts/src/micro-frontend.js";

const manifest: MicroFrontendManifest = {
  id: "questpulse", displayName: "QuestPulse", version: "0.1.0", apiVersion: "1",
  route: "/questpulse", entrypoint: "/assets/tlce/branches/questpulse/entry.js",
  requestedCapabilities: ["questpulse.offers.read"], dependencies: [],
};

function harness() {
  const calls: unknown[] = [];
  const services: MicroFrontendServices = {
    async request(input) { calls.push(input); return { ok: true }; },
    publish(name, payload) { calls.push({ name, payload }); },
    subscribe(name) { calls.push({ subscribe: name }); return () => {}; },
  };
  return { calls, services };
}

test("denies missing capabilities before loading the frontend", async () => {
  const registry = new MicroFrontendRegistry();
  registry.register(manifest);
  let loads = 0;
  const host = new MicroFrontendHost(registry, async () => {
    loads += 1;
    return { mount: async () => ({ unmount() {} }) };
  });
  const { services } = harness();
  await assert.rejects(
    host.mount("questpulse", {} as HTMLElement, "request-1", new Set(), services, "/questpulse"),
    /capability/i,
  );
  assert.equal(loads, 0);
});

test("scopes API calls to granted capabilities and safe paths", async () => {
  const registry = new MicroFrontendRegistry();
  registry.register(manifest);
  const { calls, services } = harness();
  let facade: MicroFrontendServices | undefined;
  const host = new MicroFrontendHost(registry, async () => ({
    mount: async ({ context }) => {
      facade = context.services;
      return { unmount() {} };
    },
  }));
  await host.mount("questpulse", {} as HTMLElement, "request-2",
    new Set(["questpulse.offers.read"]), services, "/questpulse/offers");

  await assert.rejects(facade!.request({
    capability: "admin.users.delete", method: "GET", path: "/users",
  }), /denied/i);
  await assert.rejects(facade!.request({
    capability: "questpulse.offers.read", method: "TRACE", path: "/offers",
  }), /method/i);
  await assert.rejects(facade!.request({
    capability: "questpulse.offers.read", method: "GET", path: "/%2e%2e/private",
  }), /path/i);

  await facade!.request({
    capability: "questpulse.offers.read", method: "get", path: "/offers",
  });
  assert.deepEqual(calls, [{
    capability: "questpulse.offers.read", method: "GET", path: "/offers",
  }]);
});

test("rejects cross-module event names and requires event permissions", async () => {
  const eventManifest = {
    ...manifest,
    requestedCapabilities: ["questpulse.offers.read", "events.publish"],
  };
  const registry = new MicroFrontendRegistry();
  registry.register(eventManifest);
  const { calls, services } = harness();
  let facade: MicroFrontendServices | undefined;
  const host = new MicroFrontendHost(registry, async () => ({
    mount: async ({ context }) => {
      facade = context.services;
      return { unmount() {} };
    },
  }));
  await host.mount("questpulse", {} as HTMLElement, "request-3",
    new Set(eventManifest.requestedCapabilities), services, "/questpulse");
  assert.throws(() => facade!.publish("other-module.secret", {}), /namespace/i);
  facade!.publish("questpulse.offer.updated", { id: "offer-1" });
  assert.deepEqual(calls, [{
    name: "questpulse.offer.updated", payload: { id: "offer-1" },
  }]);
});

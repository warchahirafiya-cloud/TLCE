import test from "node:test";
import assert from "node:assert/strict";
import { createTLCEHost } from "../src/index.js";

test("public runtime entrypoint exports the QuestPulse host", () => {
  const services = {
    async request(): Promise<never> {
      throw new Error("No Q.P capabilities are enabled");
    },
    publish(): never {
      throw new Error("No Q.P capabilities are enabled");
    },
    subscribe(): never {
      throw new Error("No Q.P capabilities are enabled");
    },
  };

  const host = createTLCEHost({ services });

  assert.equal(typeof host.mount, "function");
  assert.equal(typeof host.unmount, "function");
  assert.equal(host.branchRegistry.get("questpulse")?.route, "/questpulse");
  assert.equal(host.runtime.isActive("questpulse"), false);
});

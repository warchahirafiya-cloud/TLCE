import test from "node:test";
import assert from "node:assert/strict";
import { createTLCEApplicationRouter } from "../src/application-router.js";

function fakeWindow(initialPath = "/") {
  let pathname = initialPath;
  const listeners = new Map<string, Set<() => void>>();
  const origin = "https://tlce.test";
  const windowRef = {
    location: {
      get pathname() { return pathname; },
      get origin() { return origin; },
      get href() { return new URL(pathname, origin).href; },
    },
    history: {
      pushState(_state: unknown, _title: string, url: string) {
        pathname = new URL(url, origin).pathname;
      },
    },
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const entries = listeners.get(type) ?? new Set<() => void>();
      entries.add(listener as () => void);
      listeners.set(type, entries);
    },
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      listeners.get(type)?.delete(listener as () => void);
    },
    fire(type: string) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
  };
  return windowRef as unknown as Window & { fire(type: string): void };
}

function harness(initialPath = "/") {
  const calls: string[] = [];
  const host = {
    async mount(_root: HTMLElement, _id: string, _caps: ReadonlySet<string>, route: string) {
      calls.push(`mount:${route}`);
    },
    async unmount() {
      calls.push("unmount");
      return true;
    },
  };
  const windowRef = fakeWindow(initialPath);
  const router = createTLCEApplicationRouter({
    host,
    root: {} as HTMLElement,
    windowRef,
    requestIdFactory: () => "route-test",
  });
  return { calls, windowRef, router };
}

test("mounts QuestPulse when the initial browser route is inside its namespace", async () => {
  const { calls, router } = harness("/questpulse/offers");
  await router.start();
  assert.deepEqual(calls, ["mount:/questpulse/offers"]);
  assert.equal(router.currentRoute, "/questpulse/offers");
  await router.stop();
  assert.deepEqual(calls, ["mount:/questpulse/offers", "unmount"]);
});

test("navigation into and out of QuestPulse mounts and unmounts the module", async () => {
  const { calls, router } = harness("/");
  await router.start();
  await router.navigate("/questpulse");
  await router.navigate("/about");
  assert.deepEqual(calls, ["mount:/questpulse", "unmount"]);
  assert.equal(router.currentRoute, undefined);
  await router.stop();
});

test("popstate restores the route lifecycle", async () => {
  const { calls, windowRef, router } = harness("/questpulse");
  await router.start();
  windowRef.history.pushState(null, "", "https://tlce.test/home");
  windowRef.fire("popstate");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["mount:/questpulse", "unmount"]);
  await router.stop();
});

test("rejects cross-origin navigation", async () => {
  const { router } = harness("/");
  await router.start();
  await assert.rejects(router.navigate("https://attacker.test/questpulse"), /current origin/);
  await router.stop();
});

test("does not mount similarly prefixed unrelated routes", async () => {
  const { calls, router } = harness("/questpulse-evil");
  await router.start();
  assert.deepEqual(calls, []);
  await router.stop();
});

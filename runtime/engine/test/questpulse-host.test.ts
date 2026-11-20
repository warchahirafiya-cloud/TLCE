import test from "node:test";
import assert from "node:assert/strict";
import { createTLCEHost } from "../src/questpulse-host.js";

interface TestElement {
  tagName: string;
  attributes: Record<string, string>;
  children: TestElement[];
  id: string;
  className: string;
  textContent: string;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  append(...items: TestElement[]): void;
}

function fakeElement(tagName: string): TestElement {
  const attributes: Record<string, string> = {};
  const children: TestElement[] = [];
  const element: TestElement = {
    tagName, attributes, children, id: "", className: "", textContent: "",
    setAttribute(name, value) { attributes[name] = value; },
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null; },
    append(...items) { children.push(...items); },
  };
  return element;
}

interface FakeRoot {
  ownerDocument: { createElement(tag: string): TestElement };
  children: TestElement[];
  replaceChildren(...items: TestElement[]): void;
}

function fakeRoot(): FakeRoot {
  return {
    ownerDocument: { createElement: fakeElement },
    children: [],
    replaceChildren(...items) { this.children = items; },
  };
}

const services = {
  async request(): Promise<never> {
    throw new Error("No Q.P capabilities are enabled in this integration phase");
  },
  publish(): never {
    throw new Error("No Q.P event capabilities are enabled in this integration phase");
  },
  subscribe(): never {
    throw new Error("No Q.P event capabilities are enabled in this integration phase");
  },
};

function testFrontendMount(options: { disposeError?: Error } = {}) {
  let mountCount = 0;
  let unmountCount = 0;
  return {
    get mountCount() { return mountCount; },
    get unmountCount() { return unmountCount; },
    async mount(root: HTMLElement): Promise<() => void> {
      mountCount += 1;
      const element = fakeElement("section");
      element.setAttribute("data-tlce-branch", "questpulse");
      (root as unknown as FakeRoot).replaceChildren(element);
      return () => {
        unmountCount += 1;
        if (options.disposeError) throw options.disposeError;
        (root as unknown as FakeRoot).replaceChildren();
      };
    },
  };
}

test("mounts the QuestPulse frontend through TLCE and tears it down cleanly", async () => {
  const frontend = testFrontendMount();
  const host = createTLCEHost({
    services,
    frontendBaseUrl: "/",
    frontendMount: (root) => frontend.mount(root),
  });
  const root = fakeRoot();

  assert.equal(host.branchRegistry.get("questpulse")?.route, "/questpulse");
  await host.mount(root as unknown as HTMLElement, "request-test-1", new Set<string>(), "/questpulse/offers");

  assert.equal(host.runtime.isActive("questpulse"), true);
  assert.equal(host.frontendHost.isMounted("questpulse"), true);
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].getAttribute("data-tlce-branch"), "questpulse");
  assert.equal(frontend.mountCount, 1);

  await host.mount(root as unknown as HTMLElement, "request-test-1-repeat", new Set<string>(), "/questpulse");
  assert.equal(frontend.mountCount, 1, "duplicate mount must not duplicate the frontend");

  assert.equal(await host.unmount(), true);
  assert.equal(host.runtime.isActive("questpulse"), false);
  assert.equal(host.frontendHost.isMounted("questpulse"), false);
  assert.equal(root.children.length, 0);
  assert.equal(frontend.unmountCount, 1);
});

test("does not start the branch when the route is outside its namespace", async () => {
  const frontend = testFrontendMount();
  const host = createTLCEHost({
    services,
    frontendMount: (root) => frontend.mount(root),
  });

  await assert.rejects(
    host.mount(fakeRoot() as unknown as HTMLElement, "request-test-2", new Set<string>(), "/admin"),
    /does not match registered/,
  );

  assert.equal(host.runtime.isActive("questpulse"), false);
  assert.equal(frontend.mountCount, 0);
});

test("stops the runtime module if frontend mounting fails", async () => {
  const host = createTLCEHost({
    services,
    frontendMount: async () => { throw new Error("frontend unavailable"); },
  });

  await assert.rejects(
    host.mount(fakeRoot() as unknown as HTMLElement, "request-test-3", new Set<string>(), "/questpulse"),
    /frontend unavailable/,
  );
  assert.equal(host.runtime.isActive("questpulse"), false);
  assert.equal(host.frontendHost.isMounted("questpulse"), false);
});

test("deduplicates concurrent mount requests", async () => {
  const frontend = testFrontendMount();
  const host = createTLCEHost({
    services,
    frontendMount: (root) => frontend.mount(root),
  });
  const root = fakeRoot() as unknown as HTMLElement;

  await Promise.all([
    host.mount(root, "concurrent-1", new Set<string>(), "/questpulse"),
    host.mount(root, "concurrent-2", new Set<string>(), "/questpulse/offers"),
  ]);

  assert.equal(frontend.mountCount, 1);
  assert.equal(host.frontendHost.isMounted("questpulse"), true);
  assert.equal(host.runtime.isActive("questpulse"), true);
});

test("queues unmount requested while frontend mounting is still in progress", async () => {
  const frontend = testFrontendMount();
  let releaseMount!: () => void;
  let signalMountStarted!: () => void;
  const mountGate = new Promise<void>((resolve) => { releaseMount = resolve; });
  const mountStarted = new Promise<void>((resolve) => { signalMountStarted = resolve; });
  const host = createTLCEHost({
    services,
    frontendMount: async (root) => {
      signalMountStarted();
      await mountGate;
      return frontend.mount(root);
    },
  });
  const root = fakeRoot() as unknown as HTMLElement;

  const mounting = host.mount(root, "mount-before-unmount", new Set<string>(), "/questpulse");
  await mountStarted;
  const unmounting = host.unmount();
  releaseMount();

  await mounting;
  assert.equal(await unmounting, true);
  assert.equal(host.runtime.isActive("questpulse"), false);
  assert.equal(host.frontendHost.isMounted("questpulse"), false);
  assert.equal(frontend.unmountCount, 1);
});

test("stops runtime and clears host state even when frontend disposal throws", async () => {
  const frontend = testFrontendMount({ disposeError: new Error("dispose failed") });
  const host = createTLCEHost({
    services,
    frontendMount: (root) => frontend.mount(root),
  });
  const root = fakeRoot() as unknown as HTMLElement;

  await host.mount(root, "dispose-failure", new Set<string>(), "/questpulse");
  await assert.rejects(host.unmount(), /dispose failed/);

  assert.equal(host.runtime.isActive("questpulse"), false);
  assert.equal(host.frontendHost.isMounted("questpulse"), false);
  assert.equal((root as unknown as FakeRoot).children.length, 0);
  assert.equal(frontend.unmountCount, 1);
});

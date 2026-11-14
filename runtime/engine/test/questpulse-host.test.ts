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
    tagName,
    attributes,
    children,
    id: "",
    className: "",
    textContent: "",
    setAttribute(name: string, value: string): void {
      attributes[name] = value;
    },
    getAttribute(name: string): string | null {
      return Object.prototype.hasOwnProperty.call(attributes, name)
        ? attributes[name]
        : null;
    },
    append(...items: TestElement[]): void {
      children.push(...items);
    },
  };

  return element;
}

interface FakeRoot {
  ownerDocument: { createElement(tag: string): TestElement };
  children: TestElement[];
  replaceChildren(...items: TestElement[]): void;
}

function fakeRoot(): FakeRoot {
  const documentRef = {
    createElement(tag: string): TestElement {
      return fakeElement(tag);
    },
  };

  return {
    ownerDocument: documentRef,
    children: [],
    replaceChildren(...items: TestElement[]): void {
      this.children = items;
    },
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

test("mounts QuestPulse under the TLCE host and tears it down cleanly", async () => {
  const host = createTLCEHost({ services });
  const root = fakeRoot();

  assert.equal(host.branchRegistry.get("questpulse")?.route, "/questpulse");
  await host.mount(
    root as unknown as HTMLElement,
    "request-test-1",
    new Set<string>(),
    "/questpulse/offers",
  );

  assert.equal(host.runtime.isActive("questpulse"), true);
  assert.equal(host.frontendHost.isMounted("questpulse"), true);
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].getAttribute("data-tlce-branch"), "questpulse");

  assert.equal(await host.unmount(), true);
  assert.equal(host.runtime.isActive("questpulse"), false);
  assert.equal(host.frontendHost.isMounted("questpulse"), false);
  assert.equal(root.children.length, 0);
});

test("does not start the branch when the route is outside its namespace", async () => {
  const host = createTLCEHost({ services });

  await assert.rejects(
    host.mount(
      fakeRoot() as unknown as HTMLElement,
      "request-test-2",
      new Set<string>(),
      "/admin",
    ),
    /does not match registered/,
  );

  assert.equal(host.runtime.isActive("questpulse"), false);
});

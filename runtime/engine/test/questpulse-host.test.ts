import test from "node:test";
import assert from "node:assert/strict";
import { createQuestPulseHost } from "../src/questpulse-host.js";

interface FakeElement {
  tagName: string;
  attributes: Map<string, string>;
  children: FakeElement[];
  id: string;
  className: string;
  textContent: string;
  setAttribute(name: string, value: string): void;
  append(...items: FakeElement[]): void;
}
function fakeElement(tagName: string): FakeElement {
  const attributes = new Map<string, string>();
  const children: FakeElement[] = [];
  return {
    tagName, attributes, children, id: "", className: "", textContent: "",
    setAttribute(name, value) { attributes.set(name, value); },
    append(...items) { children.push(...items); },
  };
}

interface FakeRoot {
  ownerDocument: { createElement(tag: string): FakeElement };
  children: FakeElement[];
  replaceChildren(...items: FakeElement[]): void;
}
function fakeRoot(): FakeRoot {
  const documentRef = { createElement: (tag: string) => fakeElement(tag) };
  return {
    ownerDocument: documentRef,
    children: [],
    replaceChildren(...items) { this.children = items; },
  };
}

const services = {
  async request() { throw new Error("No Q.P capabilities are enabled in this integration phase"); },
  publish() { throw new Error("No Q.P event capabilities are enabled in this integration phase"); },
  subscribe() { throw new Error("No Q.P event capabilities are enabled in this integration phase"); },
};

test("mounts QuestPulse under the TLCE host and tears it down cleanly", async () => {
  const host = createQuestPulseHost({ services });
  const root = fakeRoot();

  assert.equal(host.branchRegistry.get("questpulse")?.route, "/questpulse");
  await host.mount(root as unknown as HTMLElement, "request-test-1", new Set(), "/questpulse/offers");
  assert.equal(host.runtime.isActive("questpulse"), true);
  assert.equal(host.frontendHost.isMounted("questpulse"), true);
  assert.equal(root.children.length, 1);
  assert.equal(root.children[0].attributes.get("data-tlce-branch"), "questpulse");

  assert.equal(await host.unmount(), true);
  assert.equal(host.runtime.isActive("questpulse"), false);
  assert.equal(host.frontendHost.isMounted("questpulse"), false);
  assert.equal(root.children.length, 0);
});

test("does not start the branch when the route is outside its namespace", async () => {
  const host = createQuestPulseHost({ services });
  await assert.rejects(
    host.mount(fakeRoot(), "request-test-2", new Set(), "/admin"),
    /does not match registered/,
  );
  assert.equal(host.runtime.isActive("questpulse"), false);
});

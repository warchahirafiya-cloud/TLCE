import test from "node:test";
import assert from "node:assert/strict";
import { ComponentRegistry } from "../src/component-registry";
import type { TLCEComponentDefinition } from "../src/component-contract";

const component: TLCEComponentDefinition = {
 manifest: {
  id: "tlce-button", version: "1.0.0", apiVersion: "1", styleEntry: "/design-system/components.css",
  accessibility: { keyboardOperable: true, semanticRoot: true, accessibleNameRequired: true },
 },
 render: () => ({} as HTMLElement),
};
test("registers versioned accessible shared components", () => {
 const registry = new ComponentRegistry(); registry.register(component);
 assert.equal(registry.get("tlce-button")?.manifest.version, "1.0.0");
});
test("rejects inaccessible components and unsafe style paths", () => {
 const registry = new ComponentRegistry();
 assert.throws(() => registry.register({ ...component, manifest: { ...component.manifest, accessibility: { ...component.manifest.accessibility, keyboardOperable: false } } }), /accessibility/);
 assert.throws(() => registry.register({ ...component, manifest: { ...component.manifest, styleEntry: "https://cdn.example/styles.css" } }), /same-origin/);
 assert.throws(() => registry.register({ ...component, manifest: { ...component.manifest, styleEntry: "/../../secret.css" } }), /same-origin/);
});
test("rejects duplicate component ids", () => {
 const registry = new ComponentRegistry(); registry.register(component);
 assert.throws(() => registry.register(component), /already registered/);
});

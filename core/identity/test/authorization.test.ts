import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorized } from "../src/authorization";

test("denies access when no permission is granted", () => {
  assert.equal(isAuthorized({ granted: [], resource: "profile", action: "read" }), false);
});

test("allows only an explicitly granted resource and action", () => {
  const granted = [{ resource: "profile", actions: ["read"] }];
  assert.equal(isAuthorized({ granted, resource: "profile", action: "read" }), true);
  assert.equal(isAuthorized({ granted, resource: "profile", action: "write" }), false);
  assert.equal(isAuthorized({ granted, resource: "billing", action: "read" }), false);
});

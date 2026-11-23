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

test("does not interpret wildcard grants as global access", () => {
  const granted = [{ resource: "*", actions: ["*"] }];
  assert.equal(isAuthorized({ granted, resource: "profile", action: "read" }), false);
  assert.equal(isAuthorized({ granted, resource: "*", action: "*" }), false);
});

test("fails closed for malformed permission records", () => {
  assert.equal(isAuthorized({ granted: [null] as never, resource: "profile", action: "read" }), false);
  assert.equal(isAuthorized({ granted: [{ resource: "profile", actions: "read" }] as never, resource: "profile", action: "read" }), false);
  assert.equal(isAuthorized({ granted: [{ resource: "profile", actions: ["read", "*"] }] as never, resource: "profile", action: "read" }), false);
});

test("rejects malformed request identifiers and does not normalize case", () => {
  const granted = [{ resource: "profile", actions: ["read"] }];
  assert.equal(isAuthorized({ granted, resource: "../profile", action: "read" }), false);
  assert.equal(isAuthorized({ granted, resource: "Profile", action: "read" }), false);
  assert.equal(isAuthorized({ granted, resource: "profile", action: "READ" }), false);
});

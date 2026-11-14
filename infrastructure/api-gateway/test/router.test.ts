import test from "node:test";
import assert from "node:assert/strict";
import { ApiGatewayRouter } from "../src/router.js";

test("dispatches a public route and preserves request correlation", async () => {
  const gateway = new ApiGatewayRouter();
  gateway.register({ method: "GET", path: "/health", handler: () => ({ status: 200, requestId: "ignored", body: { ok: true } }) });
  const response = await gateway.dispatch({ method: "GET", path: "/health", requestId: "req-1" });
  assert.equal(response.status, 200);
  assert.equal(response.requestId, "req-1");
});

test("denies protected routes without a principal or capability", async () => {
  const gateway = new ApiGatewayRouter();
  gateway.register({ method: "POST", path: "/admin/jobs", requiredCapability: "jobs:write", handler: () => ({ status: 202, requestId: "ignored" }) });
  assert.equal((await gateway.dispatch({ method: "POST", path: "/admin/jobs", requestId: "req-2" })).status, 401);
  assert.equal((await gateway.dispatch({ method: "POST", path: "/admin/jobs", requestId: "req-3", principal: { moduleId: "quest-pulse", capabilities: new Set(["jobs:read"]) } })).status, 403);
});

test("distinguishes unknown paths and unsupported methods", async () => {
  const gateway = new ApiGatewayRouter();
  gateway.register({ method: "GET", path: "/items", handler: () => ({ status: 200, requestId: "" }) });
  assert.equal((await gateway.dispatch({ method: "POST", path: "/items", requestId: "r" })).status, 405);
  assert.equal((await gateway.dispatch({ method: "GET", path: "/missing", requestId: "r" })).status, 404);
});

test("does not expose handler exceptions", async () => {
  const gateway = new ApiGatewayRouter();
  gateway.register({ method: "GET", path: "/failure", handler: () => { throw new Error("secret internal detail"); } });
  const response = await gateway.dispatch({ method: "GET", path: "/failure", requestId: "r" });
  assert.equal(response.status, 500);
  assert.equal(JSON.stringify(response).includes("secret internal detail"), false);
});

test("rejects traversal, query, fragment, and malformed paths", async () => {
  const gateway = new ApiGatewayRouter();
  assert.throws(() => gateway.register({ method: "GET", path: "/../admin", handler: () => ({ status: 200, requestId: "" }) }), /normalized/);
  assert.equal((await gateway.dispatch({ method: "GET", path: "/a/../admin", requestId: "r" })).status, 400);
  assert.equal((await gateway.dispatch({ method: "GET", path: "/health?admin=true", requestId: "r" })).status, 400);
});

test("rejects malformed request identifiers and unsupported methods", async () => {
  const gateway = new ApiGatewayRouter();
  assert.equal((await gateway.dispatch({ method: "TRACE" as never, path: "/health", requestId: "r" })).status, 400);
  assert.equal((await gateway.dispatch({ method: "GET", path: "/health", requestId: "bad id" })).status, 400);
});

test("rejects invalid route capabilities and handlers", () => {
  const gateway = new ApiGatewayRouter();
  assert.throws(() => gateway.register({ method: "GET", path: "/admin", requiredCapability: " ", handler: () => ({ status: 200, requestId: "" }) }), /capability/);
});

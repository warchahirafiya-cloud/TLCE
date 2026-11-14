import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  MCP_PUBLIC_URL: "http://127.0.0.1:8787/mcp",
  MCP_OAUTH_INTROSPECTION_URL: "http://127.0.0.1:9999/introspect",
  MCP_OAUTH_CLIENT_ID: "test-client",
  MCP_OAUTH_CLIENT_SECRET: "test-secret"
};

test("loads a loopback development configuration", () => {
  const config = loadConfig(validEnv);
  assert.equal(config.bindHost, "127.0.0.1");
  assert.equal(config.port, 8787);
  assert.deepEqual(config.requiredScopes, ["mcp:connect"]);
});

test("requires HTTPS for production endpoints", () => {
  assert.throws(
    () => loadConfig({ ...validEnv, NODE_ENV: "production" }),
    /must use HTTPS/
  );
});

test("rejects URL-shaped origin allowlist entries", () => {
  assert.throws(
    () => loadConfig({ ...validEnv, MCP_ALLOWED_ORIGINS: "https://example.test" }),
    /hostnames only/
  );
});

test("requires an explicit allowed host for the public resource URL", () => {
  assert.throws(
    () => loadConfig({ ...validEnv, MCP_ALLOWED_HOSTS: "localhost" }),
    /MCP_PUBLIC_URL hostname/
  );
});

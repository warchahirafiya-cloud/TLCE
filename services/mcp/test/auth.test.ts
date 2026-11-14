import test from "node:test";
import assert from "node:assert/strict";
import { audienceMatches, parseScopes } from "../src/auth.js";

test("audience must match origin and resource path", () => {
  const expected = new URL("https://mcp.example.test/mcp");
  assert.equal(audienceMatches("https://mcp.example.test/mcp", expected), true);
  assert.equal(audienceMatches("https://mcp.example.test/other", expected), false);
  assert.equal(audienceMatches("http://mcp.example.test/mcp", expected), false);
  assert.equal(audienceMatches(["https://other.test/mcp", "https://mcp.example.test/mcp/"], expected), true);
});

test("scope parsing is whitespace tolerant and deduplicated", () => {
  assert.deepEqual(parseScopes("mcp:connect  tlce:health:read mcp:connect"), ["mcp:connect", "tlce:health:read"]);
  assert.deepEqual(parseScopes(null), []);
});

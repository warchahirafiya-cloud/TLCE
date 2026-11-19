import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("QuestPulse ships a restrictive meta Content Security Policy", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const match = html.match(/<meta\\s+http-equiv="Content-Security-Policy"\\s+content="([^"]+)"/i);
  assert.ok(match, "CSP meta policy must exist");
  const policy = match[1];
  for (const directive of [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
  ]) {
    assert.ok(policy.includes(directive), `CSP must include ${directive}`);
  }
  assert.ok(!policy.includes("'unsafe-inline'"), "inline script/style execution must remain disabled");
});

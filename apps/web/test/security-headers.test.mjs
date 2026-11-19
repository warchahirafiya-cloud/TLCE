import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("QuestPulse ships a restrictive meta Content Security Policy", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const marker = 'http-equiv="Content-Security-Policy"';
  const markerIndex = html.indexOf(marker);
  assert.notEqual(markerIndex, -1, "CSP meta policy must exist");
  const tagStart = html.lastIndexOf("<meta", markerIndex);
  const tagEnd = html.indexOf(">", markerIndex);
  assert.notEqual(tagStart, -1);
  assert.notEqual(tagEnd, -1);
  const tag = html.slice(tagStart, tagEnd + 1);
  const policy = tag.match(/content="([^"]+)"/)?.[1];
  assert.ok(policy, "CSP content attribute must exist");
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

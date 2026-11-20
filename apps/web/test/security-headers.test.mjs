import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const publicPages = [
  "../index.html",
  "../questpulse/index.html",
  "../store/index.html",
  "../store/product/index.html",
  "../store/developers/index.html",
];

test("every public HTML page ships a restrictive Content Security Policy", async () => {
  for (const page of publicPages) {
    const html = await readFile(new URL(page, import.meta.url), "utf8");
    const marker = 'http-equiv="Content-Security-Policy"';
    const markerIndex = html.indexOf(marker);
    assert.notEqual(markerIndex, -1, `${page} must include a CSP meta policy`);
    const tagStart = html.lastIndexOf("<meta", markerIndex);
    const tagEnd = html.indexOf(">", markerIndex);
    assert.notEqual(tagStart, -1);
    assert.notEqual(tagEnd, -1);
    const tag = html.slice(tagStart, tagEnd + 1);
    const policy = tag.match(/content="([^"]+)"/)?.[1];
    assert.ok(policy, `${page} CSP content attribute must exist`);
    for (const directive of [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "script-src 'self'",
      "style-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
    ]) {
      assert.ok(policy.includes(directive), `${page} CSP must include ${directive}`);
    }
    assert.ok(!policy.includes("'unsafe-inline'"), `${page} must not enable unsafe inline execution`);
  }
});

test("public HTML pages do not add inline scripts or inline event handlers", async () => {
  for (const page of publicPages) {
    const html = await readFile(new URL(page, import.meta.url), "utf8");
    assert.doesNotMatch(html, /<script\b(?![^>]*\bsrc=)[^>]*>/i, `${page} must not contain inline script blocks`);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${page} must not use inline event handlers`);
  }
});

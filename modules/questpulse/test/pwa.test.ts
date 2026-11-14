import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const webRoot = new URL("../web/", import.meta.url);
const read = (name: string) => readFile(new URL(name, webRoot), "utf8");

test("PWA manifest uses a relative scope and standalone display", async () => {
  const manifest = JSON.parse(await read("manifest.webmanifest")) as {
    start_url: string;
    scope: string;
    display: string;
    icons: Array<{ src: string; sizes: string }>;
  };
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.src === "./icon.svg"));
});

test("service worker caches only the static app shell allowlist", async () => {
  const worker = await read("service-worker.js");
  assert.match(worker, /const SHELL_FILES = \[/);
  assert.match(worker, /if \(request\.method !== "GET"\) return/);
  assert.match(worker, /if \(requestUrl\.origin !== self\.location\.origin\) return/);
  assert.match(worker, /if \(!shellUrls\.has\(requestUrl\.href\)\) return/);
});

test("PWA app shell does not claim live listing or account capabilities", async () => {
  const html = await read("index.html");
  assert.match(html, /Prototype shell/);
  assert.match(html, /does not yet contain live listings, account features/);
});

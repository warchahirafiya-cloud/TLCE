import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("TLCE parent shell exposes the runtime mount point and browser entry", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="tlce-module-root"/);
  assert.match(html, /<base href="__TLCE_BASE_HREF__">/);
  assert.match(html, /src="\.\/bootstrap\.js"/);
  assert.match(html, /href="\.\/questpulse\//);
});

test("parent bootstrap creates the host and route composition root", async () => {
  const bootstrap = await readFile(new URL("../bootstrap.js", import.meta.url), "utf8");
  assert.match(bootstrap, /createTLCEHost/);
  assert.match(bootstrap, /createTLCEApplicationRouter/);
  assert.match(bootstrap, /new URL\("\.\/web\/", import\.meta\.url\)/);
  assert.match(bootstrap, /router\.start\(\)/);
  assert.match(bootstrap, /router\.navigate/);
});

test("parent bootstrap derives the deployed project base path", async () => {
  const bootstrap = await readFile(new URL("../bootstrap.js", import.meta.url), "utf8");
  assert.match(bootstrap, /basePath: new URL\("\.", import\.meta\.url\)\.pathname/);
});

test("GitHub Pages fallback can restore a deep QuestPulse route", async () => {
  const fallback = await readFile(new URL("../404.html", import.meta.url), "utf8");
  assert.match(fallback, /<base href="__TLCE_BASE_HREF__">/);
  assert.match(fallback, /src="\.\/bootstrap\.js"/);
  assert.match(fallback, /id="tlce-module-root"/);
});


test("TLCE parent homepage contains useful ecosystem content and canonical module links", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /class="home-shell"/);
  assert.match(html, /منظومة رقمية/);
  assert.match(html, /href="\.\/questpulse\//);
  assert.match(html, /href="\.\/store\//);
  assert.doesNotMatch(html, /intentionally empty and reserved for publishing/);
});

test("parent router restores the static homepage after leaving a mounted module", async () => {
  const bootstrap = await readFile(new URL("../bootstrap.js", import.meta.url), "utf8");
  assert.match(bootstrap, /const homeMarkup = root\.innerHTML/);
  assert.match(bootstrap, /function restoreHome\(\)/);
  assert.match(bootstrap, /restoreHome\(\);/);
});

test("Pages build publishes QuestPulse at its canonical directory route", async () => {
  const workflow = await readFile(new URL("../../../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
  assert.match(workflow, /npm run build:static/);
  assert.match(workflow, /path: dist\/pages/);
  assert.match(workflow, /get\("questpulse\/",/);
  const assembler = await readFile(new URL("../../../scripts/assemble-pages.mjs", import.meta.url), "utf8");
  assert.match(assembler, /apps\/web\/questpulse/);
  assert.match(assembler, /questpulse\/index\.html/);
  const webWorkflow = await readFile(new URL("../../../.github/workflows/questpulse-web.yml", import.meta.url), "utf8");
  assert.match(webWorkflow, /Assemble and validate Pages artifact/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("TLCE parent shell exposes the runtime mount point and browser entry", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /id="tlce-module-root"/);
  assert.match(html, /src="\.\/bootstrap\.js"/);
  assert.match(html, /data-route="\/questpulse"/);
});

test("parent bootstrap creates the host and route composition root", async () => {
  const bootstrap = await readFile(new URL("../bootstrap.js", import.meta.url), "utf8");
  assert.match(bootstrap, /createTLCEHost/);
  assert.match(bootstrap, /createTLCEApplicationRouter/);
  assert.match(bootstrap, /new URL\("\.\/web\/", import\.meta\.url\)/);
  assert.match(bootstrap, /router\.start\(\)/);
  assert.match(bootstrap, /router\.navigate/);
});

test("GitHub Pages fallback can restore a deep QuestPulse route", async () => {
  const fallback = await readFile(new URL("../404.html", import.meta.url), "utf8");
  assert.match(fallback, /src="\.\/bootstrap\.js"/);
  assert.match(fallback, /id="tlce-module-root"/);
});

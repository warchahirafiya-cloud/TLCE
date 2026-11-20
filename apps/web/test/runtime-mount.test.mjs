import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("standalone QuestPulse page uses the lifecycle bootstrap", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const bootstrap = await readFile(new URL("../bootstrap.js", import.meta.url), "utf8");
  const app = await readFile(new URL("../questpulse.js", import.meta.url), "utf8");

  assert.match(html, /data-questpulse-app/);
  assert.match(html, /src="\.\/bootstrap\.js"/);
  assert.match(bootstrap, /mountQuestPulse/);
  assert.match(app, /export function mountQuestPulse\(root\)/);
  assert.match(app, /return \(\) => controller\.abort\(\)/);
});

test("runtime stylesheet is scoped to the QuestPulse shadow host", async () => {
  const css = await readFile(new URL("../styles.runtime.css", import.meta.url), "utf8");
  assert.match(css, /:host\{/);
  assert.doesNotMatch(css, /(^|})\s*:root\s*\{/);
  assert.doesNotMatch(css, /(^|})\s*body\s*\{/);
});

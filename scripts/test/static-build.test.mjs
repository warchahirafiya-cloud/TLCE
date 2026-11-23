import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve("dist/pages");

async function htmlFiles(directory) {
  const files = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) files.push(...await htmlFiles(fullPath));
    else if (item.isFile() && item.name.endsWith(".html")) files.push(fullPath);
  }
  return files;
}

test("static artifact retains TLCE, QuestPulse and Store routes", async () => {
  for (const file of [
    "index.html",
    "404.html",
    "questpulse/index.html",
    "store/index.html",
    "store/developers/index.html",
    "store/product/index.html",
    "web/index.html",
    "web/questpulse.js",
    "web/styles.css",
    "runtime/engine/src/index.js",
  ]) {
    const content = await readFile(path.join(root, file));
    assert.ok(content.length > 0, `Missing or empty Pages artifact: ${file}`);
  }

  const parent = await readFile(path.join(root, "index.html"), "utf8");
  const questpulse = await readFile(path.join(root, "questpulse/index.html"), "utf8");
  const store = await readFile(path.join(root, "store/index.html"), "utf8");
  assert.match(parent, /href="\.\/questpulse\//);
  assert.doesNotMatch(parent, /__TLCE_BASE_HREF__/);
  assert.match(questpulse, /\.\.\/web\/styles\.css/);
  assert.match(questpulse, /\.\.\/web\/questpulse\.js/);
  assert.match(store, /TLCE STORE/);
});

test("all HTML routes receive a same-origin island bridge entry", async () => {
  const pages = await htmlFiles(root);
  assert.ok(pages.length >= 6, "Expected parent, QuestPulse and store HTML pages");
  for (const file of pages) {
    const html = await readFile(file, "utf8");
    assert.match(html, /data-tlce-islands-entry/);
    assert.match(html, /_ui\/assets\/tlce-islands-[^"]+\.js/);
  }
});

test("Tailwind CSS is emitted as a same-origin asset for Shadow DOM islands", async () => {
  const css = await readFile(path.join(root, "ui/assets/tlce-islands.css"), "utf8");
  assert.match(css, /--color-tlce-accent/);
  assert.match(css, /\.inline-flex/);
});

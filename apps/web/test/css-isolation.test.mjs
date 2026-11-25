import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path) => readFileSync(resolve(here, path), "utf8");

test("page entrypoints do not load the unscoped shared design-system stylesheet", () => {
  const pages = [
    read("../../parent/index.html"),
    read("../index.html"),
    read("../questpulse/index.html"),
    read("../store/index.html"),
    read("../store/developers/index.html"),
    read("../store/product/index.html"),
  ];

  for (const html of pages) {
    assert.doesNotMatch(html, /ui-system\.css/i);
  }
});

test("QuestPulse shadow stylesheet retains its dark host theme without global token overrides", () => {
  const css = read("../styles.runtime.css");

  assert.match(css, /:host\{background:radial-gradient/);
  assert.doesNotMatch(css, /Shared TLCE design system mirrored into the QuestPulse Shadow DOM scope/);
  assert.doesNotMatch(css, /--color-bg/);
});

test("the parent platform keeps its own dark-and-gold palette", () => {
  const css = read("../../parent/styles.css");

  assert.match(css, /:root\{color-scheme:dark/);
  assert.match(css, /--accent:#c7a66a/);
});

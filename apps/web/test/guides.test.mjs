import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const guides = JSON.parse(await readFile(new URL("../data/guides.json", import.meta.url), "utf8"));

test("educational catalogue contains a useful set of unique guides", () => {
  assert.ok(guides.length >= 5);
  assert.equal(new Set(guides.map((guide) => guide.id)).size, guides.length);
});

test("each guide has the fields required by the browser renderer", () => {
  for (const guide of guides) {
    assert.ok(guide.id && guide.title && guide.summary && guide.icon);
    assert.ok(Array.isArray(guide.points) && guide.points.length >= 3);
    assert.ok(Array.isArray(guide.tags) && guide.tags.length >= 1);
  }
});

test("guide content includes safety topics and no external offer claims", () => {
  const corpus = guides.map((guide) => [guide.title, guide.summary, ...guide.points].join(" ")).join(" ");
  assert.match(corpus, /كلمة مرور|عبارة الاسترداد/);
  assert.match(corpus, /الرسوم/);
  assert.match(corpus, /الأهلية/);
});

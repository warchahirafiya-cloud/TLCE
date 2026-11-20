import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const jsonLd = (html) => [...html.matchAll(/<script type="application\\/ld\\+json"(?: id="[^"]+")?>([\\s\\S]*?)<\\/script>/g)]
  .map((match) => JSON.parse(match[1]));

test("TLCE parent homepage exposes Organization and WebSite structured data", () => {
  const html = read("../../parent/index.html");
  const graph = jsonLd(html)[0]?.["@graph"] ?? [];
  assert.ok(graph.some((item) => item["@type"] === "Organization" && item.name === "The Last Cosmic Explosion"));
  assert.ok(graph.some((item) => item["@type"] === "WebSite" && item.url === "https://tlce.store/"));
});

test("public platform pages expose page-level structured data", () => {
  const store = jsonLd(read("../store/index.html"))[0];
  const developers = jsonLd(read("../store/developers/index.html"))[0];
  const questpulse = jsonLd(read("../questpulse/index.html"))[0];
  assert.equal(store["@type"], "CollectionPage");
  assert.equal(developers["@type"], "WebPage");
  assert.equal(questpulse["@type"], "WebApplication");
  assert.equal(questpulse.isPartOf["@id"], "https://tlce.store/#website");
});

test("QuestPulse product route has crawlable fallback content and software schema", () => {
  const html = read("../store/product/index.html");
  const schema = jsonLd(html)[0];
  assert.match(html, /<h1>QuestPulse<\\/h1>/);
  assert.match(html, /name="description" content="QuestPulse:/);
  assert.match(html, /<a class="primary" href="\\.\\.\\/\\.\\.\\/questpulse\\/">فتح التطبيق<\\/a>/);
  assert.equal(schema["@type"], "SoftwareApplication");
  assert.equal(schema.name, "QuestPulse");
  assert.equal(schema.softwareVersion, "1.0.0");
});

test("product controller updates metadata from the approved catalogue record", () => {
  const script = read("../store/product/product.js");
  assert.match(script, /function updateProductMetadata\\(product\\)/);
  assert.match(script, /document\\.title = title/);
  assert.match(script, /schema\\.textContent = JSON\\.stringify/);
});

test("sitemap omits unverified lastmod timestamps", () => {
  const sitemap = read("../sitemap.xml");
  assert.match(sitemap, /<urlset/);
  assert.doesNotMatch(sitemap, /<lastmod>/);
  assert.match(sitemap, /https:\\/\\/tlce\\.store\\/store\\/product\\/\\?id=questpulse/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filterApprovedApps, isApprovedStoreItem, isSafeStoreLaunchPath, escapeStoreText } from "../store/catalogue.mjs";

const approvedWebApp = {
  id: "questpulse",
  name: "QuestPulse",
  description: "TLCE discovery module",
  platform: "web",
  category: "learning",
  developerName: "TLCE Team",
  version: "1.0.0",
  status: "published",
  reviewStatus: "approved",
  developerApproved: true,
  launchPath: "../questpulse/index.html"
};

test("public catalogue includes the approved first-party web module", () => {
  assert.equal(isApprovedStoreItem(approvedWebApp), true);
  assert.deepEqual(filterApprovedApps([approvedWebApp]).map((item) => item.id), ["questpulse"]);
});

test("unreviewed or unapproved developer submissions never become public", () => {
  assert.equal(isApprovedStoreItem({ ...approvedWebApp, reviewStatus: "under_review" }), false);
  assert.equal(isApprovedStoreItem({ ...approvedWebApp, developerApproved: false }), false);
  assert.equal(isApprovedStoreItem({ ...approvedWebApp, status: "draft" }), false);
});

test("Android package links remain disabled in the static storefront", () => {
  const androidApp = {
    ...approvedWebApp,
    id: "android-demo",
    platform: "android",
    launchPath: undefined,
    downloadUrl: "https://example.invalid/app.apk"
  };
  assert.equal(isApprovedStoreItem(androidApp), false);
});

test("web launch paths cannot use external or protocol-relative URLs", () => {
  assert.equal(isApprovedStoreItem({ ...approvedWebApp, launchPath: "https://evil.example" }), false);
  assert.equal(isApprovedStoreItem({ ...approvedWebApp, launchPath: "//evil.example" }), false);
  assert.equal(isApprovedStoreItem({ ...approvedWebApp, launchPath: "../index.html" }), true);
});

test("catalogue text is escaped before HTML rendering", () => {
  assert.equal(escapeStoreText('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("catalogue filters by platform, category, and search term", () => {
  assert.equal(filterApprovedApps([approvedWebApp], { platform: "android" }).length, 0);
  assert.equal(filterApprovedApps([approvedWebApp], { category: "learning" }).length, 1);
  assert.equal(filterApprovedApps([approvedWebApp], { search: "not found" }).length, 0);
});

test("checked-in store data contains only the approved QuestPulse entry", () => {
  const data = JSON.parse(readFileSync(new URL("../store/data/apps.json", import.meta.url), "utf8"));
  assert.equal(data.length, 1);
  assert.deepEqual(filterApprovedApps(data).map((item) => item.id), ["questpulse"]);
});

test("store launch paths reject traversal, encoded paths, and non-HTML targets", () => {
  assert.equal(isSafeStoreLaunchPath("../questpulse/index.html"), true);
  assert.equal(isSafeStoreLaunchPath("../questpulse/index.html"), true);
  assert.equal(isSafeStoreLaunchPath("../../outside.html"), false);
  assert.equal(isSafeStoreLaunchPath("../%2e%2e/outside.html"), false);
  assert.equal(isSafeStoreLaunchPath("..\\\\outside.html"), false);
  assert.equal(isSafeStoreLaunchPath("https://example.com/app.html"), false);
  assert.equal(isSafeStoreLaunchPath("../download.apk"), false);
});

test("duplicate product IDs are reduced to one public catalogue entry", () => {
  const duplicate = { ...approvedWebApp, name: "Duplicate listing" };
  assert.equal(filterApprovedApps([approvedWebApp, duplicate]).length, 1);
});

test("overlong catalogue fields are rejected", () => {
  assert.equal(isApprovedStoreItem({ ...approvedWebApp, name: "x".repeat(101) }), false);
  assert.equal(isApprovedStoreItem({ ...approvedWebApp, description: "x".repeat(2001) }), false);
});

test("developer program page and submission contract are present and parseable", async () => {
  const { existsSync } = await import("node:fs");
  const schema = JSON.parse(readFileSync(new URL("../../../docs/architecture/TLCE-STORE-submission.schema.json", import.meta.url), "utf8"));
  const developerPage = new URL("../store/developers/index.html", import.meta.url);
  assert.equal(existsSync(developerPage), true);
  assert.equal(schema.title, "TLCE STORE Product Submission");
  assert.equal(schema.properties.developerType.enum.includes("approved_external"), true);
  assert.equal(schema.properties.product.properties.platform.enum.includes("android"), true);
});

test("product detail route and controller are part of the store bundle", async () => {
  const { existsSync, readFileSync } = await import("node:fs");
  const htmlPath = new URL("../store/product/index.html", import.meta.url);
  const scriptPath = new URL("../store/product/product.js", import.meta.url);
  assert.equal(existsSync(htmlPath), true);
  assert.equal(existsSync(scriptPath), true);
  const html = readFileSync(htmlPath, "utf8");
  const script = readFileSync(scriptPath, "utf8");
  assert.match(html, /product\.js/);
  assert.match(script, /filterApprovedApps/);
  assert.match(script, /product not published/);
});

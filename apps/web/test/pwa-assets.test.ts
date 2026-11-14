import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("PWA manifest declares standalone installable TLCE parent app", async () => {
 const manifest = JSON.parse(await readFile("apps/web/public/manifest.webmanifest", "utf8"));
 assert.equal(manifest.name, "The Last Cosmic Explosion");
 assert.equal(manifest.display, "standalone");
 assert.equal(manifest.start_url, "/");
 assert.ok(manifest.icons.some((icon: { src: string }) => icon.src === "/icons/tlce.svg"));
});
test("service worker caches only same-origin GET shell traffic and bypasses sensitive API paths", async () => {
 const worker = await readFile("apps/web/public/sw.js", "utf8");
 assert.match(worker, /request\.method !== "GET"/);
 assert.match(worker, /url\.origin !== self\.location\.origin/);
 assert.match(worker, /url\.pathname\.startsWith\("\/api\/"\)/);
 assert.match(worker, /url\.pathname\.startsWith\("\/auth\/"\)/);
 assert.match(worker, /url\.pathname\.startsWith\("\/integrations\/"\)/);
 assert.match(worker, /offline\.html/);
});
test("app shell communicates that backend services are not active", async () => {
 const html = await readFile("apps/web/public/index.html", "utf8");
 assert.match(html, /QuestPulse is an internal product module/);
 assert.match(html, /Sign-in, data operations and task execution will appear after the trusted backend is activated/);
});

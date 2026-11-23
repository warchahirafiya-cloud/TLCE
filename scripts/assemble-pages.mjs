import assert from "node:assert/strict";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(repositoryRoot, "dist", "pages");
const uiBuildRoot = path.join(repositoryRoot, "dist", "ui-build");
const manifestPath = path.join(uiBuildRoot, ".vite", "manifest.json");

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const entry = manifest["src/islands/entry.tsx"];
assert.ok(entry?.file, "Vite manifest is missing the Preact island entry");
const islandAsset = entry.file;
assert.ok(islandAsset.startsWith("assets/"), "Unexpected island asset output path");

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

async function copy(source, destination) {
  await cp(path.join(repositoryRoot, source), path.join(outputRoot, destination), {
    recursive: true,
    force: true,
  });
}

await copy("apps/web", "web");
await copy("apps/web/store", "store");
await copy("apps/web/questpulse", "questpulse");
await copy("apps/parent/index.html", "index.html");
await copy("apps/parent/404.html", "404.html");
await copy("apps/parent/bootstrap.js", "bootstrap.js");
await copy("apps/parent/styles.css", "styles.css");
await copy("apps/web/favicon.svg", "favicon.svg");
await copy("dist/browser/runtime", "runtime");
await copy("dist/ui-build/assets", "_ui/assets");

const questpulsePath = path.join(outputRoot, "questpulse", "index.html");
let questpulseHtml = await readFile(questpulsePath, "utf8");
questpulseHtml = questpulseHtml
  .replaceAll('href="../styles.css"', 'href="../web/styles.css"')
  .replaceAll('src="../questpulse.js"', 'src="../web/questpulse.js"');
assert.ok(questpulseHtml.includes("../web/styles.css"), "QuestPulse stylesheet route was not rewritten");
assert.ok(questpulseHtml.includes("../web/questpulse.js"), "QuestPulse module route was not rewritten");
await writeFile(questpulsePath, questpulseHtml);

const configuredBasePath = (process.env.TLCE_BASE_PATH ?? "").trim();
const normalizedBasePath = configuredBasePath
  ? `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}/`
  : "/";
for (const file of ["index.html", "404.html"]) {
  const fullPath = path.join(outputRoot, file);
  const html = (await readFile(fullPath, "utf8")).replaceAll("__TLCE_BASE_HREF__", normalizedBasePath);
  await writeFile(fullPath, html);
}

async function injectIslandBridge(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, item.name);
    if (item.isDirectory()) {
      await injectIslandBridge(fullPath);
      continue;
    }
    if (!item.isFile() || !item.name.endsWith(".html")) continue;

    const relativeAsset = path.relative(path.dirname(fullPath), path.join(outputRoot, "_ui", islandAsset))
      .split(path.sep).join("/");
    const scriptPath = relativeAsset.startsWith(".") ? relativeAsset : `./${relativeAsset}`;
    let html = await readFile(fullPath, "utf8");
    if (html.includes("data-tlce-islands-entry")) continue;
    const script = `<script type="module" data-tlce-islands-entry src="${scriptPath}"></script>`;
    if (html.includes("</body>")) html = html.replace("</body>", `  ${script}\n</body>`);
    else html = `${html}\n${script}\n`;
    await writeFile(fullPath, html);
  }
}

await injectIslandBridge(outputRoot);

const required = [
  "index.html",
  "404.html",
  "questpulse/index.html",
  "store/index.html",
  "store/developers/index.html",
  "store/product/index.html",
  "web/questpulse.js",
  "web/styles.css",
  "runtime/engine/src/index.js",
  `_ui/${islandAsset}`,
  "_ui/assets/tlce-islands.css",
];
for (const relative of required) {
  const fullPath = path.join(outputRoot, relative);
  await readFile(fullPath);
}

console.log(`Static Pages artifact assembled at dist/pages (base: ${normalizedBasePath}).`);

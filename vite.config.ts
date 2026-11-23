import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  plugins: command === "serve" ? [{
    name: "tlce-questpulse-local-island-preview",
    transformIndexHtml(html, context) {
      if (context.path !== "/apps/web/questpulse/" && context.path !== "/apps/web/questpulse/index.html") return html;
      return html.replace("</body>", '  <script type="module" src="/src/islands/entry.tsx"></script>\n</body>');
    },
  }] : [],
  // Keep the existing HTML/JS site as static source. Vite bundles the new
  // Preact island runtime separately; scripts/assemble-pages.mjs combines both.
  root: process.cwd(),
  publicDir: false,
  base: "./",
  build: {
    outDir: resolve(process.cwd(), "dist/ui-build"),
    emptyOutDir: true,
    manifest: true,
    target: "es2022",
    cssCodeSplit: false,
    rolldownOptions: {
      input: resolve(process.cwd(), "src/islands/entry.tsx"),
      output: {
        entryFileNames: "assets/tlce-islands-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "preact",
    },
  },
}));

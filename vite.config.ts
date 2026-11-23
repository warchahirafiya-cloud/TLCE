import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
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
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },
});

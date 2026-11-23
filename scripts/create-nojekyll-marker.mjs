import { mkdir, writeFile } from "node:fs/promises";

await mkdir("dist/pages", { recursive: true });
await writeFile("dist/pages/.nojekyll", "");

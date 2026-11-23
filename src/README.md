# TLCE frontend build layer

This branch introduces an additive Vite + TypeScript + Tailwind CSS v4 build layer while preserving the current HTML/CSS/JavaScript pages as the source of truth.

## Build

- `npm run typecheck:frontend`: type-check the Preact island bridge and Worker API client.
- `npm run build:static`: compile the existing browser runtime, bundle the Preact island entry with Vite, compile Tailwind CSS v4, and assemble the static GitHub Pages tree at `dist/pages/`.
- `npm run test:static-ui`: verify route paths, required legacy assets, same-origin island scripts and the Shadow DOM stylesheet.

The existing page sources remain in `apps/parent/` and `apps/web/`. They are copied into the output without rewriting their application JavaScript. The only existing route rewrite retained is the established QuestPulse deployment mapping from `../styles.css` and `../questpulse.js` to the shared `../web/` assets.

## Preact island bridge

The bridge is built from `src/islands/entry.tsx`. Components register by name and mount only into explicit `[data-tlce-island]` hosts. Each island gets a Shadow DOM root and a same-origin Tailwind stylesheet link. This keeps Tailwind preflight and utility styles from changing the legacy page CSS and remains compatible with the current `style-src 'self'` CSP.

A local preview is available at `/src/islands/dev.html` when running Vite's development server.

## Worker API client

`src/services/worker-api.ts` contains typed wrappers for the existing authenticated Worker routes:

- `POST /api/ai/chat`
- `POST /api/files/presign`
- `POST /api/files/upload` (raw file bytes, not multipart)
- `POST /api/files/complete`

Same-origin requests use `credentials: include` so the browser can send its Cloudflare Access session cookie. No Access JWT is copied into localStorage or application-managed storage. The client rejects cross-origin API bases by default.

Direct-to-R2 presigned PUT is optional and uses `credentials: omit`; it requires an explicitly configured R2 CORS policy for the production/staging origin and required signed headers.

## Deployment boundary

- The PR validation workflow builds and uploads a seven-day preview artifact only. It does not deploy GitHub Pages.
- The existing Pages deployment workflow now consumes `dist/pages/`, but its deploy job is restricted to `refs/heads/main`.
- No production deployment is triggered by this feature branch or its pull request.
- The Worker routes are wrapped in a client module but are not automatically invoked by the existing UI. No upload/chat UI or release capability is enabled.
- Quarantine status is not a malware-clean verdict. No file is presented as trusted or downloadable.

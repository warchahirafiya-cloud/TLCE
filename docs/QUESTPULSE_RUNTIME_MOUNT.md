# QuestPulse Runtime Mount

Status: implementation in progress on `feature/questpulse-runtime-mount`.

## What changed

- `apps/web/questpulse.js` now exports `mountQuestPulse(root)` and returns a cleanup function that aborts pending requests and removes event listeners.
- `apps/web/bootstrap.js` mounts the same application for the standalone static Pages page.
- `apps/web/index.html` marks the app root and loads the bootstrap module.
- `apps/web/styles.runtime.css` scopes the existing visual system to a Shadow DOM host so Q.P styles do not leak into the parent TLCE interface.
- `runtime/engine/src/questpulse-host.ts` fetches the existing Q.P HTML from a configured same-origin base URL, imports its body content without executing embedded scripts, attaches scoped styles, loads the exported application module, and calls its mount/cleanup lifecycle.
- The runtime host rejects cross-origin frontend URLs and redirects. The parent document's CSP remains authoritative for script, style, and fetch execution.
- Host tests cover route rejection, duplicate mount behavior, successful teardown, and runtime rollback if frontend mounting fails.
- Web tests validate the standalone bootstrap, exported lifecycle, and scoped stylesheet.

## Configuration

Pass `frontendBaseUrl` when creating the host:
- `/apps/web/` when serving the repository directly from its root.
- `/` when the static deployment publishes the contents of `apps/web/` at the site root.

The default remains `/apps/web/` for local repository-root development. Do not derive this value from user input.

## Current limitations

- This connects the existing read-only browser shell to the runtime host. It does not create a backend API, account system, publisher portal, moderation service, or durable data store.
- The existing shell continues to load only public JSON catalogues and store saved guides in the visitor's browser.
- Runtime mounting has not been deployed to production or tested against a live parent application route. The static GitHub Pages deployment remains a separate release artifact.
- No user data, SQLite database, legacy identity/session tables, DNS records, paid services, or protected `app.asar` asset has been migrated or changed.
- The host's frontend adapter seam is intended for deterministic tests and must never be populated from user-controlled input.

## Verification

Run:
- `npm run typecheck`
- `npm test`
- `node --check apps/web/bootstrap.js`
- `node --test apps/web/test/*.test.mjs`

A green CI run verifies compilation and tests, not production deployment readiness.

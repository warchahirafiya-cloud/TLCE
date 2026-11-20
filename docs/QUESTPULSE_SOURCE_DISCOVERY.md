# QuestPulse Source Discovery and Integration Map

Reviewed: 2026-11-19
Scope: repository/source discovery only; no runtime code, protected archive, data, DNS, or hosting settings changed.

## 1. Confirmed repositories

### Parent platform
- Repository: https://github.com/warchahirafiya-cloud/TLCE
- Default branch: `main`
- Latest reviewed main commit: `e68c47371c884fc5a1230c908fb9dc56071bf0ae`
- TLCE is the parent application. QuestPulse remains an internal module.

### Existing QuestPulse source project
- Repository: https://github.com/warchahirafiya-cloud/QuestPulse
- Default branch: `main`
- Latest reviewed commit: `9429ed4c3b2df8472a3ee99bbdaa5d831f9ec2b6`
- This is a real, separate repository containing the earlier Q.P website and a publisher API prototype. Treat it as the source/reference project for selective migration, not as a second parent application.

## 2. Current TLCE-hosted web shell

The actual integrated web-shell source is already present in TLCE:

- `apps/web/index.html` — Arabic RTL static Q.P page.
- `apps/web/styles.css` — page styling.
- `apps/web/questpulse.js` — browser UI, offer and guide loading, search/filtering, browser-local saved guides.
- `apps/web/questpulse-catalogue.mjs` — public offer allowlist and freshness validation.
- `apps/web/data/offers.json` — current public catalogue.
- `apps/web/data/guides.json` — knowledge-centre content.
- `apps/web/test/` — browser-module and security-related tests.
- `modules/questpulse/README.md` — internal module boundary.
- `runtime/engine/src/questpulse-host.ts` — current Q.P host/manifest lifecycle scaffold.

The host currently creates a placeholder section and starts/stops a stub module. It does not yet load or mount the `apps/web` application inside the runtime. The static page and runtime module lifecycle are therefore separate pieces, not a completed dynamic module integration.

## 3. Static deployment evidence

The TLCE repository contains `.github/workflows/deploy-pages.yml`, which validates `apps/web`, uploads that directory as a Pages artifact, and deploys it.

Verified run:
- https://github.com/warchahirafiya-cloud/TLCE/actions/runs/44489428404
- Commit: `e68c47371c884fc5a1230c908fb9dc56071bf0ae`
- Build/validation job: success.
- Deploy job: success.
- GitHub Pages artifact: created.

This confirms a successful GitHub Pages deployment workflow for the static Q.P shell. It does not prove that a separate production API, account service, database, or full TLCE runtime is deployed. An external browser check of the public page/domain was not available during this review.

The separate QuestPulse repository also has its own GitHub Pages deployment history:
- https://github.com/warchahirafiya-cloud/QuestPulse/actions/runs/44516530118
- Main commit: `9429ed4c3b2df8472a3ee99bbdaa5d831f9ec2b6`
- Pages build/deployment: success.

Do not assume the standalone repository's custom domain automatically belongs to the TLCE deployment. Its root `CNAME` contains `getquestpulse.com`; domain/DNS ownership and routing were not changed or verified here.

## 4. Standalone Q.P source inventory

The separate Q.P repository contains:
- `index.html` and multiple static HTML pages.
- `data/offers.json`, `data/inbox.json`, `data/sources.json`.
- Editorial/feed scripts under `scripts/`.
- `server/app.js`, `server/db.js`, `server/auth.js`, `server/security.js`, `server/validation.js`.
- API tests under `server/tests/`.
- `package.json` with Node.js 22+, Express 5, better-sqlite3, bcryptjs, Helmet, rate limiting, Multer, Zod and dotenv.
- `API_PHASE_2.md` describing the API as a self-hosted scaffold, separate from GitHub Pages.

The API scaffold has local SQLite and local-disk media storage, publisher registration/activation, sessions, pending submissions and administrator moderation endpoints. It is not a deployed parent API. Its local `users` and `sessions` must not be copied into TLCE as a parallel identity system. Its `posts` and `media` must be mapped to parent-owned content/media contracts before migration.

## 5. Important product-scope mismatch

The current TLCE web shell and the standalone Q.P README both state that the active website scope excludes cryptocurrency, blockchain, tokens, mining and wallet features. Historical Web3/crypto material remains in the standalone repository's `archive/crypto/` directory.

This is a real product-scope decision reflected in current source, not an assumption made by this audit. Do not silently restore archived crypto features during migration.

## 6. Correct integration direction

1. Treat `TLCE/apps/web` as the current deployed static Q.P shell.
2. Treat `warchahirafiya-cloud/QuestPulse` as the legacy/reference source for selectively reviewed domain features and content.
3. Keep `modules/questpulse` and the runtime host as the internal module boundary.
4. Integrate the web shell through a deliberate frontend mount/route adapter; do not duplicate the runtime or publish a second independent Q.P parent application.
5. Replace the standalone API's local identity/session authority with TLCE identity and authorization.
6. Map Q.P offer/post records to parent canonical content and parent media storage only after reviewing real schemas and migration rules.
7. Keep all writes, publishing, moderation, and external side effects behind parent authorization, audit, and approval policies.

## 7. Current launch state

- Static Q.P shell: Pages workflow deployed successfully on TLCE main.
- Static content: current offers catalogue is intentionally empty; guides are available.
- Runtime module: lifecycle/manifest scaffold exists; actual frontend mounting remains incomplete.
- Standalone Q.P API: prototype source exists; no live deployment established.
- TLCE production backend: authentication, durable data, outbox, persistent audit, monitoring, and production hosting remain incomplete.
- Domain: separate Q.P repository contains a CNAME file, but custom-domain resolution and ownership are not verified here.
- No paid service, DNS change, data migration, production secret, or protected `app.asar` modification was performed.

The next implementation milestone is to mount the existing `apps/web` shell through the TLCE Q.P host with route and security tests, then design parent-owned identity/content/media services. Do not migrate the standalone SQLite identity or deploy its API as-is.

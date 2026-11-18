# QuestPulse Source Inventory and TLCE Integration Baseline

**Status:** Read-only source audit captured on a dedicated branch.  
**Audit date:** 2026-11-18  
**QuestPulse source:** `warchahirafiya-cloud/QuestPulse`  
**QuestPulse inspected commit:** `a1aba165123516b471dd6d318381fb1896fcdd9f`  
**TLCE parent inspected commit:** `ab16d247b88469fb498755c36fecf3dd00dff2e5`

## 1. Product scope confirmed from the active QuestPulse repository

The active QuestPulse README defines the product as a global directory for reviewed rewards, online stores, discounts, coupons, competitions, loyalty programmes, and digital tasks.

The active website explicitly excludes cryptocurrency, blockchain, token, mining, and wallet features. Those materials remain in the historical `archive/crypto/` area and must not be brought into the active TLCE branch as part of this integration.

The product's editorial rule is source-backed publication: an imported feed item is only a candidate. An editor must verify the original source, eligible countries, validity, fees, terms, and redemption method before an offer is manually published.

## 2. Existing QuestPulse implementation

### Public web application

- `index.html` is the active static website.
- `data/offers.json` is currently an empty array. There are no published offers in the inspected commit.
- `data/sources.json` contains candidate-only sources: a US curated offers feed, a UK curated vouchers feed, and Meh's US-focused daily-deal RSS. eBay and Flipkart integrations are planned and require credentials.
- `scripts/ingest-offer-feeds.mjs` imports candidate items; it does not publish them.
- `scripts/validate-inbox.mjs`, `scripts/validate-offers.mjs`, and `scripts/validate-site.mjs` validate the data and static site.
- The current feed registry does not yet establish genuinely global offer coverage: the active feeds are US/UK-focused.

### Publisher API prototype

The repository contains a separate Node.js API scaffold:

- Runtime requirement: Node.js 22 or newer.
- Express 5, SQLite via `better-sqlite3`, bcrypt password hashing, rate limiting, Helmet, Multer media uploads, Zod validation, and dotenv configuration.
- `server/db.js` creates local `users`, `sessions`, `posts`, and `media` tables.
- `server/app.js` provides publisher registration/login/logout/session endpoints, pending submissions, public published-post reads, media handling, and administrator review endpoints.
- New publisher accounts begin pending; submissions are not automatically published.
- Sessions are represented by a separate `qp_session` cookie and stored in the Q.P SQLite database.
- Media is stored on local disk. The API documentation limits this architecture to a single-instance deployment with persistent local storage.

The API is a prototype and is not deployed by GitHub Pages. The repository's API setup guide explicitly says not to connect the public form to this API until hosting and security review are complete.

### Tests and deployment evidence

- The package exposes `npm run test:api`, covering the security and validation helper test files.
- The inspected default-branch tree contains two API test files: `server/tests/security.test.js` and `server/tests/validation.test.js`.
- GitHub Actions run `44296661261` for commit `a1aba165123516b471dd6d318381fb1896fcdd9f` completed successfully as the GitHub Pages build/deployment workflow. Its check runs are `build`, `deploy`, and `report-build-status`.
- The separate `questpulse-quality.yml` workflow is configured to run dependency audit, JavaScript syntax checks, API helper tests, and website/catalogue validators. Those checks were not present in the inspected commit's check-run list, so this audit does **not** claim that the API tests or dependency audit passed on that SHA.
- This proves the inspected static Pages deployment workflow succeeded. It does not prove that the Node.js API is deployed or operational.

Documented API gaps include email verification, password reset, legal-entity ownership verification, malware scanning, image/video transcoding, backup/restore automation, audit-log UI, and multi-instance object storage. Full HTTP lifecycle, authorization, moderation, upload-abuse, and concurrency integration coverage remains to be established.

## 3. TLCE parent integration boundary

The inspected TLCE `main` commit is `ab16d247b88469fb498755c36fecf3dd00dff2e5`.

TLCE currently has a module/runtime foundation and a QuestPulse host adapter. The current `runtime/engine/src/questpulse-host.ts` registers the Q.P module and mounts a generic host section; it does not contain the QuestPulse offer catalogue, publisher experience, or domain workflows.

The TLCE repository's build-status, roadmap, and threat-model documents identify important production capabilities that are not yet implemented, including production authentication, persistent data adapters, durable event storage, persistent audit storage, hardened module isolation, and DNS-aware outbound egress controls. Passing the current TypeScript and unit-test workflow is not a production-readiness claim.


### Current TLCE web-shell state

- The inspected TLCE `main` tree does not contain an `apps/web/` application or a browser-host build script. Its `package.json` currently exposes TypeScript typecheck and unit-test scripts only.
- Draft PR #5 contains a static PWA shell under `apps/web/public/`, a `build:web` script, and a QuestPulse mount-contract placeholder. It remains open/draft and targets `feature/serverless-edge`, not `main`.
- PR #5's own documentation says its Q.P UI is only a minimal mount surface; the existing Q.P website and business workflows are not embedded. Its branch cannot be treated as the current main web application or as an integrated Q.P RC.
- At this audit point, `feature/serverless-edge` is diverged from `main` by 134 commits ahead and 4 behind. PR #5 is stacked on that diverged branch, so merging the draft into `main` wholesale would import a large, independently evolved foundation and is not an acceptable shortcut.
- The current main host adapter and PR #5's more extensive branch-host implementation are different code states. Porting the shell requires a deliberate reconciliation against current main, not merging the stacked draft branch blindly.

## 4. Non-negotiable integration rules

The standalone Q.P API must not be copied wholesale into TLCE.

| Existing Q.P prototype | Target ownership in TLCE | Required treatment |
|---|---|---|
| Q.P `users` and `sessions` tables, password hashes, `qp_session` cookie | TLCE Identity and session boundary | Do not create a parallel identity authority. Replace with parent actor/session contracts once those contracts are implemented and reviewed. |
| Q.P `posts` | TLCE canonical content plus Q.P offer-domain data | Map accepted Q.P content to a parent-owned canonical content ID. Keep offer-specific fields in the Q.P domain. |
| Q.P local media table and disk uploads | TLCE Media | Do not assume local-disk storage is suitable for parent or multi-instance production use. |
| Q.P admin review endpoints | TLCE Authorization, Moderation, and Audit | Map to parent roles, branch/object scope, reason codes, and auditable actions. |
| Q.P reactions/comments/shares | TLCE Social Engine | The Q.P API does not implement these as a shared social service. Do not add a second social graph in Q.P. |

No data migration should be designed or run until the actual TLCE schema, identity, authorization, content, media, moderation, and deployment contracts are available and reviewed.

## 5. Recommended first Release Candidate scope

The first integrated RC should be a **non-production, testable Q.P branch inside TLCE**:

1. Port the active non-crypto QuestPulse public experience into the Q.P module boundary.
2. Preserve the source-backed offer model, candidate-only ingestion, manual publication gate, and empty-catalogue state.
3. Keep publisher registration, login, submissions, uploads, and moderation disabled until parent identity, authorization, media, and moderation contracts are implemented.
4. Keep social actions disabled until the parent Social Engine has real APIs and tests.
5. Do not import the historical crypto archive into the active branch.
6. Add Q.P module unit, contract, accessibility, and browser-level integration tests.
7. Produce a reviewable test artifact and PR. No merge, production deployment, DNS change, production data migration, paid service, or secret provisioning is included.

## 6. Immediate engineering sequence

1. Confirm the exact TLCE parent contracts and current source paths.
2. Create a Q.P domain model for offers, sources, country eligibility, expiry, and editorial verification without introducing Q.P-owned users or sessions.
3. Port the active public Q.P interface into the TLCE branch host using the current repository conventions.
4. Add safe, read-only offer rendering and empty-state behavior; preserve candidate-versus-published separation.
5. Add tests for source attribution, country/expiry display, URL safety, unverified-state handling, and branch route lifecycle.
6. Keep publisher/API integration behind an explicit disabled boundary until parent services exist.
7. Run CI on the exact PR head, then request independent review. A successful CI run is not a security certification.

## 7. Change boundary for this audit

This document records repository evidence and an integration proposal only. It does not modify the standalone QuestPulse repository, the TLCE `main` branch, the protected `app.asar` reference, production data, credentials, DNS, hosting, or deployment configuration.

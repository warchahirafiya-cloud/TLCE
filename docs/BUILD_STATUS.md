# TLCE Build Status

Last reviewed: 2026-11-21
Baseline: `main` at `a48d6e76087bf2088fa6579d7154f7455367691e`

## Current verified repository state

- TLCE is the parent platform; QuestPulse remains an internal module under the parent route.
- The parent runtime, module registry, lifecycle contracts, browser composition and QuestPulse route integration are present on `main`.
- The public Pages workflow assembles the parent shell at the site root and QuestPulse assets beneath the nested web path.
- The store and developer-information pages are present. The developer page is informational; it explicitly says that application intake and file upload are not active.
- SEO crawl files and canonical metadata are present for the public pages.
- Organization, WebSite, page-level and QuestPulse SoftwareApplication structured data are included.
- A production smoke-check job is configured to verify the deployed TLCE HTML, CSP, runtime assets, QuestPulse assets and JSON catalogues at `https://tlce.store/`.
- QuestPulse offer and candidate-inbox domain validation is included in the root typecheck and test suite. Feed ingestion remains candidate-only; publication requires editorial review and complete source, eligibility, fee and terms disclosures.
- PR #33's exact head commit `5b90830c3f65404870ba6bae32c9649d01174865` passed both GitHub Actions checks: TLCE CI run `44833316213` (typecheck and unit tests) and QuestPulse Web run `44833316208` (browser module validation, browser build, catalogue validation and browser tests). That commit is now represented by the latest `main` commit `a48d6e76087bf2088fa6579d7154f7455367691e`.

## Production and release gaps — not complete

- The public site is a static GitHub Pages experience. It does not provide live user registration, production authentication, persistent developer accounts, shared uploads, central submissions, live moderation, checkout or payment processing.
- The developer programme page is informational only; no production intake workflow is active.
- The production identity and gateway layer still needs OIDC/JWT verification, schema validation, shared rate limiting, quotas, tenant isolation and a real HTTP/edge adapter.
- The runtime executes module implementations in-process; hardened process/container isolation and signed module artifact verification are absent.
- Event delivery still needs a durable atomic idempotency store, lease recovery, durable broker/dead-letter adapters and replay/poison-message procedures.
- Network-level egress controls and cloud metadata isolation are not provisioned.
- Persistent audit storage, access controls, retention, encryption and operational alerts are not configured.
- Production database/cache adapters, secrets injection, monitoring, tracing, health/readiness probes and SLOs are not configured.
- Root CI still uses `npm install`; a committed lockfile and reproducible `npm ci` pipeline remain outstanding.
- SBOM generation and automated dependency/secret scanning need to be completed or independently evidenced.
- The legacy QuestPulse source, routes, schema and business rules are not fully migrated into the parent module. The protected `app.asar` reference remains read-only.
- Public legal policy coverage and hosting-level HTTP security-header behavior still require explicit review. A meta CSP is not equivalent to response headers; GitHub Pages does not provide arbitrary response-header configuration.
- The Pages deployment for `main` commit `a48d6e76087bf2088fa6579d7154f7455367691e` completed successfully in run `44833390931`, including the live production smoke check. The later PR #34 merge changed documentation only and did not match the Pages workflow path filters, so it did not trigger a new site deployment.

## Public domain and legal verification

- The latest Pages deployment (run `44833390931`) successfully fetched `https://tlce.store/` and verified the TLCE parent HTML, QuestPulse presence, CSP, runtime assets and catalogues. This is direct evidence that `tlce.store` served the TLCE deployment at the time of that run.
- An earlier audit document says the apex still served the legacy standalone QuestPulse site. That statement conflicts with the later successful production smoke check and must be treated as stale or unresolved until a fresh browser check of both apex and `www` confirms current routing, HTTPS and canonical redirects. The absence of a root `CNAME` in the Actions-based source tree is not, by itself, proof that the custom domain is unconfigured.
- Do not transfer the domain, change Pages settings or edit DNS based only on the older audit. Re-check first; the available GitHub connector cannot perform Pages settings changes.
- Project-specific Privacy Policy and Terms of Use pages are not yet published; operator identity and contact details must be confirmed rather than invented.

## Verification boundaries

- The exact PR #33 head SHA passed TLCE CI and QuestPulse Web checks as recorded above.
- The production deployment smoke check passed for the latest site deployment on commit `a48d6e76087bf2088fa6579d7154f7455367691e` (run `44833390931`), explicitly fetching `https://tlce.store/` and validating the TLCE page, CSP, runtime, QuestPulse assets and catalogues.
- A green build or static Pages deployment does not establish production readiness for authentication, payments, developer publishing, backend operations or security isolation.
- Do not provision services, migrate production data, alter DNS/Pages settings, publish payments, expose backend traffic or modify protected assets without explicit approval.

## Next release sequence

1. Reconcile the older custom-domain audit with the successful smoke check by verifying `https://tlce.store/` and `https://www.tlce.store/` in a real browser, including HTTPS certificate and canonical redirect behavior. Do not change DNS or Pages settings unless this fresh check identifies a fault.
2. Publish reviewed, project-specific Privacy Policy, Terms of Use, contact and support information after the operator details are confirmed.
3. Decide whether the first release is a static catalogue/marketing release or a transactional app-store release; do not imply unavailable functions.
4. For a transactional release, implement and independently verify identity, developer onboarding, upload scanning, moderation, persistent storage, checkout/payment and operational controls.
5. Complete legacy QuestPulse migration mapping and contract tests without modifying the protected `app.asar`.
6. Run independent threat-model, abuse-case, accessibility, browser E2E, rollback and release reviews.

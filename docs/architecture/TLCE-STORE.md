# TLCE STORE Architecture

**Status:** Initial architecture baseline  
**Parent platform:** THE LAST COSMIC EXPLOSION (TLCE)  
**Deployment boundary:** `apps/web/store/` is a child module of the existing `apps/web` deployment.

## Product decisions

- One hybrid catalogue for web applications, Android applications, and digital tools.
- Publishers are limited to the TLCE team and externally approved developers.
- Every public listing requires an explicit published state, an approved review state, and an approved developer record.
- QuestPulse remains a first-party TLCE module. It is listed in the store as an entry point, not extracted into a separate product.
- The store does not imply that Android APK distribution is operational.

## Initial module layout

- `apps/web/store/index.html`: accessible Arabic RTL storefront.
- `apps/web/store/store.css`: isolated responsive presentation layer.
- `apps/web/store/store.js`: browser-side catalogue controller.
- `apps/web/store/product/`: product-detail route that resolves only approved catalogue records.
- `apps/web/store/product/product.js`: safe product-detail renderer.
- `apps/web/store/catalogue.mjs`: public-listing validation and filtering.
- `apps/web/store/data/apps.json`: static public catalogue; only approved published records are rendered.
- `apps/web/store/developers/index.html`: public developer-program guide; it is informational and does not accept submissions.
- `docs/architecture/TLCE-STORE-submission.schema.json`: proposed metadata contract for a future private submission API.
- `docs/architecture/TLCE-STORE-review-checklist.md`: internal review checklist for independent reviewers.
- `docs/architecture/TLCE-STORE-state-machine.md`: permitted lifecycle transitions, role boundaries, and audit requirements.
- `docs/architecture/TLCE-STORE-api-contract.md`: provider-neutral backend routes and authorization requirements.
- `docs/architecture/TLCE-STORE-threat-model.md`: initial threats, mitigations, and production gates.

## Publication lifecycle

`draft -> submitted -> under_review -> approved -> published`

Rejected or suspended items must never be exposed by the public catalogue. The current static implementation enforces the final public gate by requiring all of:

- `status === "published"`
- `reviewStatus === "approved"`
- `developerApproved === true`

This is a display-time safety filter, not an authorization system. A future submission API must enforce the same policy server-side and must not trust client-supplied approval flags.

## Product record contract

Required fields: `id`, `name`, `description`, `platform`, `category`, `developerName`, `version`, `status`, `reviewStatus`, `developerApproved`.

Platform values:

- `web`: a reviewed same-origin launch path.
- `android`: reserved; no public binary download until signing, provenance, malware scanning, checksum verification, and release review are implemented.
- `tool`: reserved for reviewed digital tools; external launch links are not enabled in this first baseline.

## Developer and review governance

- Eligible publishers are limited to the TLCE team and externally approved developers.
- Developer identity and ownership verification must happen in a private authenticated service; no identity documents or secrets belong in the public repository.
- Submission metadata is described by `TLCE-STORE-submission.schema.json`; schema validation is not approval.
- Reviewers must be independent from submitters. Decisions, evidence references, timestamps, and product versions must be auditable.
- The public developer page is guidance only. It must not imply that a submission endpoint or account system is live.

## Security boundaries

1. No public upload endpoint or developer account flow exists in this baseline.
2. No APK is hosted or linked by the catalogue.
3. No secrets, API keys, tokens, or personal developer data belong in the static site.
4. Public records are escaped before rendering.
5. Only local relative web launch paths are enabled.
6. The existing Content Security Policy remains self-hosted and restrictive.
7. The store is deployed only as part of `apps/web`; repository internals remain outside the Pages artifact.

## Required gates before production expansion

- Server-side developer identity and organization membership verification.
- Role-based authorization for submitter, reviewer, publisher, and administrator.
- Immutable review/audit log and explicit reviewer approval.
- Malware scanning and package metadata inspection.
- Android signing-key custody, signature verification, SHA-256 checksums, and reproducible release provenance.
- Privacy, permission, license, trademark, and content review.
- Version history, revocation/takedown, vulnerability response, and rollback process.
- Automated tests for schema validation, escaping, unsafe URLs, unauthorized states, and stale releases.

## Current limitations

This is a static storefront foundation. It has no authentication, backend, payments, upload workflow, remote update mechanism, Android binary hosting, or developer submission form. Those capabilities must be designed and secured before they are exposed to users.

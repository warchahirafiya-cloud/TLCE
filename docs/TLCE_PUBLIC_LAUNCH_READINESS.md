# TLCE Public Launch Readiness Audit

**Review date:** 2026-11-21  
**Scope:** Published static web shell in `apps/web/`, its data catalogues, GitHub Pages workflow, and public routing.  
**Status:** Pre-launch review. This document is an engineering status report, not a legal opinion, penetration-test certificate, or production-readiness certification.

## Executive result

The current GitHub Pages build is live and the public static routes for the TLCE parent, nested QuestPulse module, and TLCE Store resolve on the GitHub Pages URL. The QuestPulse product-detail CTA now opens the nested module route. The latest main-branch TLCE CI, QuestPulse Web, and Pages deployment runs completed successfully.

The custom domain `tlce.store` is **not transferred**: its public apex still serves the legacy standalone QuestPulse site. The legacy repository's GitHub Pages custom-domain setting and the TLCE repository's Pages custom-domain setting must be coordinated manually in repository Settings → Pages. DNS observations made during this audit showed GitHub Pages A records at the apex, a `www` CNAME to `warchahirafiya-cloud.github.io`, and a GitHub Pages verification TXT record. Do not change DNS unless a fresh DNS diagnosis shows it is necessary.

## Verified implementation

- TLCE is the parent homepage; QuestPulse is nested at `/questpulse/`.
- TLCE Store is nested at `/store/`.
- The QuestPulse product page's "Open app" link resolves to `/questpulse/index.html`.
- `apps/web/data/offers.json` is empty by design; no fabricated or unverified offers are presented.
- The QuestPulse guide catalogue is static JSON content.
- Saved guides are stored in browser `localStorage` under `tlce.questpulse.saved-guides.v1`; this is local browser storage, not a user account or server-side database.
- The developer-program page is informational only. It explicitly states that submissions and file uploads are not enabled.
- No public login, account registration, payment, reward ledger, publisher submission, or backend write API was found in the reviewed web shell.
- Public HTML pages use restrictive CSP meta policies. This is a browser-side policy; it is not proof that HTTP response security headers such as HSTS, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy are configured at the hosting layer.
- No inline script blocks or inline event-handler attributes were found in the reviewed public pages.
- The Pages workflow pins GitHub Actions by commit SHA, uses read-only contents permissions in the build job, and requires Pages write plus OIDC token permissions only in the deploy job.

## Security and privacy findings

### Positive controls
- CSP policies include `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, restrictive script/style/connect sources, and `form-action 'self'`.
- QuestPulse escapes catalogue and guide content before rendering it into HTML.
- Offer publication uses a client-side allow-list gate and requires HTTPS source/terms URLs, but this is not an authorization boundary for any future write service.
- External offer links, when approved records exist, use `target="_blank"` with `rel="noopener noreferrer"`.
- No API credentials or secrets were observed in the reviewed static web files. This is not a secrets scan of the entire repository or GitHub settings.
- No third-party analytics or tracking integration was observed in the reviewed public pages.

### Remaining security gaps
- GitHub Pages static hosting does not provide an application backend, authentication, server-side authorization, moderation, rate limiting, durable audit trail, or abuse controls.
- The current CSP is delivered through HTML meta tags. Hosting-level HTTP response headers have not been independently verified.
- No formal penetration test, dependency SBOM review, secret scanning result, malware scan, or independent security review is represented by this audit.
- LocalStorage can be cleared or modified by the visitor and must never be treated as authoritative or sensitive storage.
- The static site has no server-side deletion, account export, or user-data request workflow because it does not currently collect account data.

## Legal and policy readiness

No published, project-specific Terms of Use or Privacy Policy were identified in the current public web shell. Do not invent the operator's legal name, address, contact channel, data controller role, retention period, legal basis, governing law, or dispute forum. Those require owner confirmation and jurisdiction-specific review.

Before any account, analytics, publisher submission, payment, or third-party data integration is enabled, prepare and review at least:
- Privacy notice describing the actual controller/operator, data categories, purposes, legal bases where applicable, processors, international transfers, retention, rights, and contact route.
- Terms covering the informational nature of QuestPulse, third-party offer responsibility, eligibility, fees, intellectual property, prohibited conduct, liability limits, and dispute handling.
- Cookie/tracking disclosure if non-essential cookies or analytics are later introduced.
- Separate publisher/developer terms before external submissions or distribution are enabled.

Until then, keep the static product informational, avoid collecting personal information, and do not claim that a full legal compliance review has been completed.

## Release gates still open

1. **Custom domain:** transfer `tlce.store` from the legacy QuestPulse Pages configuration to TLCE Pages. This requires the repository Pages settings interface; the available GitHub connector does not expose that settings write operation.
2. **HTTPS:** after the domain handoff, wait for certificate provisioning and verify HTTPS plus the canonical apex/`www` redirect behavior. Do not claim success before testing both hostnames.
3. **HTTP security headers:** verify response headers from the actual deployed domain and decide whether a hosting layer capable of setting them is required.
4. **Legal documents:** confirm the operator/contact details and have project-specific privacy and terms text reviewed before publication.
5. **Operational security:** define monitoring, incident reporting, backup/rollback, content review ownership, and release response procedures.
6. **Commercial features:** payments, subscriptions, commissions, real reward distribution, account creation, and external publishing remain disabled until their separate technical and legal designs are reviewed.

## Regression coverage added in this branch

The web security test now checks all five public HTML entry pages for the expected restrictive CSP directives and rejects inline script blocks and inline event-handler attributes. The CI run for this branch must pass before merging.

## Explicit non-claims

This audit does not certify legal compliance, production backend security, payment readiness, or a completed custom-domain transfer. A green static-site build proves that the checked build and tests passed; it does not prove that every operational launch gate is closed.


## Verification addendum — 2026-11-21

- The TLCE documentation status/roadmap update in PR #34 was merged to `main` as commit `71b8df252e2bb51d4860a1beefc0f2604e664227`. Its PR CI passed (run #625). The subsequent main-branch CI run #626 was still in progress at the time of this addendum.
- The latest Pages deployment remains the deployment of `main` commit `a48d6e76087bf2088fa6579d7154f7455367691e`, run `44833390931`; build, deploy and the production smoke-check jobs all passed. PR #34 changed only documentation and did not match the Pages workflow's deployment path filters, so a new Pages deployment was not expected.
- The custom-domain handoff remains open: the prior audit records that `tlce.store` apex still serves the legacy standalone QuestPulse site. The TLCE main repository tree has no root `CNAME` file. Do not claim that the custom domain is serving the TLCE parent until the Pages settings handoff, certificate provisioning and apex/`www` redirect checks are complete.
- The public web shell remains static/read-only. No live account registration, developer submissions, uploads, checkout, payments, reward ledger or backend write API is deployed.
- Project-specific Privacy Policy and Terms of Use are not present in the reviewed public web tree. Confirm the legal operator and contact details before drafting or publishing them.

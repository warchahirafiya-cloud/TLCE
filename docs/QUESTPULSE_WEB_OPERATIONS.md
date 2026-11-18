# QuestPulse Web Operations

## Current delivery
- Static site source: `apps/web/`.
- QuestPulse is an internal module of TLCE, not a separate parent application.
- The public offer catalogue is intentionally empty until each record passes the publication checks.
- The knowledge centre loads from `data/guides.json`; saved guides are stored in the visitor's browser only.
- No account system, backend, payment flow, reward ledger, or production database is connected.

## Automated validation
The `QuestPulse Web` workflow runs on pull requests to `main` and pushes to `main` or `feature/**` when web files change. It checks JavaScript syntax, JSON catalogues, and Node tests.

## GitHub Pages release
The `Deploy QuestPulse to GitHub Pages` workflow is manual by design:
1. Open the repository Actions tab.
2. Select **Deploy QuestPulse to GitHub Pages**.
3. Select **Run workflow** on the `main` branch.
4. Confirm the run completes and copy the published page URL from the deployment environment.

The first run may require GitHub Pages to be enabled with **GitHub Actions** as its source in repository Settings → Pages. No custom domain or paid service is required.

## Release checks
- Confirm the latest `QuestPulse Web` workflow is green.
- Confirm the published URL loads over HTTPS and refreshes without a 404.
- Test mobile layout, navigation anchors, offer filters, guide search, saved-guide toggle, and browser-local persistence.
- Verify the public offer catalogue remains empty unless real, current, source-backed records are approved.
- Do not add API keys or credentials to `apps/web/` or the repository.

## Known limitations
The current site is a static information interface. User accounts, cross-device sync, admin publishing, moderation, server-side verification, durable storage, notifications, and reward/payment execution are not implemented. Do not describe these as active features.

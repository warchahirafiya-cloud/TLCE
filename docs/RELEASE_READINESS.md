# TLCE Release Readiness Gate

Review date: 2026-11-19
Branch reviewed: `feature/zapier-event-bridge`
Decision: **STATIC QUESTPULSE SHELL DEPLOYED; FULL PLATFORM NOT PRODUCTION-READY**

This is a repository-backed readiness assessment. It distinguishes a successful static Pages deployment from production backend readiness.

## Verified repository facts

- TLCE is the parent platform; QuestPulse is an internal module.
- The static Q.P shell exists under `apps/web/` with `index.html`, CSS, browser modules, catalogue data, guides, and tests.
- The `deploy-pages.yml` workflow validates `apps/web`, uploads it as a Pages artifact, and deploys it.
- The latest reviewed main deployment, run [44489428404](https://github.com/warchahirafiya-cloud/TLCE/actions/runs/44489428404), completed successfully on commit `e68c47371c884fc5a1230c908fb9dc56071bf0ae`; both build and deploy jobs succeeded.
- The static shell is not yet mounted by the runtime host. `runtime/engine/src/questpulse-host.ts` currently registers a stub module and creates a placeholder section.
- The separate source repository `warchahirafiya-cloud/QuestPulse` contains an earlier static site and a Node.js/Express + SQLite publisher API scaffold. That API is not deployed as part of the TLCE Pages workflow.
- The standalone Q.P API uses local SQLite and local-disk media storage; it must not be copied as a parallel identity/content authority.
- No production database, durable outbox, persistent dead-letter store, production authentication, persistent audit sink, monitoring, or production API deployment is verified.
- The current active Q.P web scope excludes cryptocurrency, blockchain, token, mining, and wallet features; historical crypto materials remain archived in the standalone repository.
- The standalone Q.P repository has a root `CNAME` for `getquestpulse.com`; this does not establish that the domain is attached to TLCE Pages. DNS and external HTTPS reachability were not verified.
- No live Zapier connection or paid service is configured.

## Launch blockers

### P0 — complete the module mount
Connect `apps/web` to the registered Q.P module route through the TLCE host. Add route, lifecycle, failure cleanup, and browser integration tests. The current static page deployment is not proof of a runtime-mounted module.

### P0 — define canonical product scope
Preserve the current source scope unless an explicit product decision changes it. Do not silently reintroduce archived cryptocurrency/mining/wallet functionality.

### P0 — parent identity, data, and security
Implement production authentication and authorization, parent-owned content/media contracts, reviewed persistence, backup/restore, input/schema validation, quotas, rate limits, secret management, and persistent audit before accepting real users or personal data.

### P0 — hosting and domain boundary
Confirm the intended canonical domain and GitHub Pages configuration. Do not move the standalone Q.P `CNAME` or change DNS without explicit approval. GitHub Pages can host the static shell, not the API, workers, durable outbox, or secrets.

### P1 — reliability and operations
Implement durable transactional outbox storage, atomic worker leases, bounded retries, durable dead-letter handling, monitoring, alerts, incident procedures, and tested restore/rollback.

### P1 — release verification
Run CI on the exact release candidate commit; run integration, security, accessibility, mobile, and end-to-end tests; verify the public page from a real browser; document support and known limitations.

## Safe release phases

1. **Static preview:** already deployed through the verified Pages workflow; static information only.
2. **Runtime integration preview:** mount the Q.P web shell within TLCE with synthetic data and no sensitive user writes.
3. **Private staging:** production-like runtime and database with synthetic data, authentication, monitoring, backups, and rollback.
4. **Limited production:** only after security, data, operational, and legal/product review with explicit go/no-go approval.
5. **General availability:** after staged rollout evidence, support process, incident response, and rollback readiness.

## Current release decision

The successful Pages deployment is a valid static-shell deployment, not a full TLCE production launch. Do not merge the current feature branch, migrate production data, deploy a backend, configure DNS, provision paid resources, or expose credentials without the required approvals.

See [QuestPulse source discovery and integration map](QUESTPULSE_SOURCE_DISCOVERY.md) for the verified repository paths and deployment evidence.

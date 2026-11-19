# TLCE Release Readiness Gate

Review date: 2026-11-19
Branch reviewed: `feature/questpulse-runtime-mount`
Decision: **STATIC QUESTPULSE SHELL DEPLOYED; RUNTIME MOUNT IMPLEMENTED ON DEVELOPMENT BRANCH; FULL PLATFORM NOT PRODUCTION-READY**

## Verified state

- The Q.P static shell exists under `apps/web/` and has a successful GitHub Pages deployment on TLCE main (run [44489428404](https://github.com/warchahirafiya-cloud/TLCE/actions/runs/44489428404)).
- The existing shell now exports a mount/cleanup lifecycle and has a standalone bootstrap.
- The TLCE Q.P host fetches the shell from a configured same-origin base URL, imports its content without executing embedded scripts, mounts it inside Shadow DOM with scoped styles, and invokes the lifecycle module.
- Host tests cover route rejection, duplicate mount, teardown, and rollback if frontend mounting fails.
- Web tests cover browser syntax, catalogue validation, bootstrap, CSP, and scoped runtime styles.
- CI on the implementation commit passed TypeScript checking, unit tests, browser module checks, catalogue checks, and browser tests.
- The standalone `warchahirafiya-cloud/QuestPulse` project contains a Node.js/Express + SQLite API prototype. It is not deployed as a TLCE backend and has not been integrated.
- The Q.P frontend remains read-only: public catalogue/guides plus browser-local saved guides.
- No production identity, database, publisher portal, moderation API, durable outbox, persistent audit, monitoring, or backup/restore service is deployed.

## Remaining launch blockers

### P0 — real application router integration
Wire `createTLCEHost` into the actual TLCE application entrypoint/router, configure `frontendBaseUrl` for the chosen deployment layout, and verify browser navigation, refresh, accessibility, and mobile behavior. The host lifecycle unit tests do not prove a real application route works.

### P0 — parent-owned identity and data
Design and implement central authentication/authorization, canonical content/media services, moderation roles, persistent audit, schema validation, rate limiting, and backup/restore before accepting user accounts, uploads, or submissions.

### P0 — production runtime and hosting
Choose and approve the production runtime target for API/workers and the static frontend. GitHub Pages hosts only the static shell; it cannot run the API, workers, durable outbox, or secrets.

### P1 — reliability and operations
Implement durable transactional outbox storage, atomic worker leases, bounded retries, durable dead-letter handling, monitoring, alerts, incident procedures, and tested rollback.

### P1 — security and release verification
Add integration, end-to-end, authorization, abuse-case, dependency, secret, and security tests. Perform a threat-model review and verify the final deployed site from a real browser.

## Protected boundaries

- Do not copy the standalone Q.P local users or sessions tables into TLCE.
- Do not modify the protected `app.asar` reference.
- Do not silently re-enable archived cryptocurrency, mining, token, or wallet features.
- Do not merge to `main`, publish a new production deployment, configure DNS, migrate user data, provision paid services, or expose credentials without explicit separate approval.

## Release phases

1. Static preview: deployed successfully.
2. Runtime integration preview: mount the Q.P shell through the actual TLCE router.
3. Private staging: parent-owned identity and persistence with synthetic data, monitoring, backups, and rollback.
4. Limited production: explicit go/no-go after security, data, and operations review.
5. General availability: after staged rollout evidence and support/incident readiness.

The current branch is an engineering implementation, not a production release.

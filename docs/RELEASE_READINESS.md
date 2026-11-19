# TLCE Release Readiness Gate

Review date: 2026-11-19
Branch reviewed: `feature/zapier-event-bridge`
Decision: **NOT READY FOR PUBLIC OR PRODUCTION LAUNCH**

This is a repository-backed readiness assessment, not a deployment record.

## Verified repository facts

- TLCE is documented as the parent platform; QuestPulse is an internal module.
- The repository contains TypeScript runtime, module, gateway, event, audit, and adapter foundations.
- The CI workflow currently performs dependency installation, TypeScript checking, and unit tests.
- The repository has no verified application entry page (`index.html`), frontend build configuration, production server entrypoint, Dockerfile, or deployment workflow in the reviewed branch paths.
- The repository package manifest has no production database or ORM dependency.
- The build status explicitly records missing production database, durable event storage, secrets management, monitoring, cloud adapters, deployment, DNS, production authentication, hardened HTTP server, and persistent audit storage.
- QuestPulse legacy routes, schema, and business rules have not been source-integrated. The protected `app.asar` reference remains untouched.
- No live Zapier connection, production secrets, or paid service is configured.

## Launch blockers

### P0 — define the launchable product artifact
The current repository is an engineering foundation, not a verified user-facing application bundle. Identify the actual TLCE frontend/application entrypoint and its build command, or explicitly define a first public landing-page release as a separate, limited deliverable.

### P0 — authoritative QuestPulse integration source
Obtain and review the authoritative Q.P source tree. Do not reconstruct business logic from the archived `app.asar` reference or infer routes and schemas from incomplete notes.

### P0 — production operating boundary
Choose and approve the hosting/runtime target, environment model, domain strategy, and rollback owner. GitHub Pages is suitable only for a static frontend and cannot host the TLCE API, workers, durable outbox, or secrets.

### P0 — identity, data, and security
Before accepting real users or personal data, implement production authentication and authorization, a reviewed data store, backup/restore, input/schema validation, rate limiting, secret management, and a persistent audit trail.

### P1 — reliability and operations
Implement durable transactional outbox storage, atomic worker leases, retry scheduling, durable dead-letter handling, monitoring, alerts, incident procedures, and tested restore/rollback.

### P1 — release verification
Run CI on the exact release candidate commit; run integration and security tests; scan dependencies and secrets; verify accessibility and mobile behavior; document known limitations and support/contact route.

## Safe release phases

1. **Engineering preview:** isolated feature branch and synthetic data only. No public user data or irreversible external actions.
2. **Static public preview:** only after a real frontend bundle and reviewed content exist. Can use an approved static host; no API secrets or claims of backend functionality.
3. **Private staging:** production-like runtime and database with synthetic/test data, authentication, monitoring, backups, and rollback.
4. **Limited production:** only after security, data, operational, and legal/product review with an explicit go/no-go approval.
5. **General availability:** after staged rollout evidence, support process, incident response, and rollback readiness.

## Current release decision

Do not merge the feature branch to `main`, publish a production deployment, configure DNS, migrate data, provision paid services, or expose credentials as part of this readiness review.

The next concrete action is to identify the actual frontend/application source and approved hosting target. Without those two facts, a deployment would be a guess, not a launch.

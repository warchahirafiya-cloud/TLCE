# TLCE Operations and Release Runbook

## Current scope

The repository contains a tested platform foundation and a static installable PWA shell. It is not a deployed service. Do not publish the shell as a live product until the backend and trusted edge gates below are complete.

## Local engineering verification

From the repository root:

```sh
npm install
npm run typecheck
npm test
```

The test command includes Runtime Engine, all Core package tests, API Gateway, Serverless Edge and PWA asset contract tests.

## Configuration preflight

Use `loadRuntimeConfig` from `core/config/src/runtime-config.ts` with an injected environment map. Production mode intentionally fails closed unless PostgreSQL, OIDC and AI provider settings are all present. This is shape validation only; it does not test connectivity or credentials.

Never place production secrets in source control, build artifacts, logs, screenshots or support tickets. Inject them from a managed secret store at runtime.

## Readiness checklist before staging

- [ ] Select hosting/runtime target and document rollback.
- [ ] Deploy a trusted HTTP edge with TLS, request limits, schema validation and rate limiting.
- [ ] Configure OIDC and a reviewed JWKS-backed token verifier.
- [ ] Provision PostgreSQL; apply migrations 001–003; verify backups and restore.
- [ ] Run dispatcher and task worker under process supervision.
- [ ] Configure AI provider adapter, quotas, cost controls and provider-side idempotency.
- [ ] Add persistent audit storage, metrics, traces, alerts and incident ownership.
- [ ] Run integration, security, crash-recovery and tenant-isolation tests.
- [ ] Review QuestPulse source compatibility and data migration plan.
- [ ] Obtain explicit release approval.

## PWA hosting constraints

Serve the contents of `apps/web/public/` from the origin root over HTTPS. The service worker scope is `/`. Configure the host to return `index.html` for the root document and preserve the explicit offline fallback. Do not cache API, authentication or integration responses in the service worker.

The PWA is a presentation shell only. It has no sign-in, business data, task submission or live service connection.

## Incident response

1. Stop new traffic at the trusted edge if authentication or tenant isolation is suspect.
2. Preserve audit and infrastructure logs; do not include raw tokens or secrets.
3. Pause the worker if it is producing duplicate or unsafe external side effects.
4. Verify database integrity and outbox leases before resuming consumers.
5. Restore from a verified backup only under the approved recovery procedure.
6. Record the incident, affected tenant scope, remediation and follow-up tests.

## Release boundary

Keep work on `feature/serverless-edge` until review and staging validation are complete. No merge to `main`, production deployment, DNS changes, paid infrastructure, credential provisioning or production data migration is authorized by this runbook.

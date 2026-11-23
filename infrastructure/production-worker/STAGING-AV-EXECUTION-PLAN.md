# Cloudflare staging and trusted-file release plan

Status: **design and readiness phase only**. This document does not provision Cloudflare resources, deploy a Worker, configure DNS, or enable a file release path.

## Current verified baseline

- PR #54 was merged into `fix/parent-home-questpulse-routing` at merge commit `b4087ab5e73f9be63eeadac02984ea011bafe36b`.
- The Worker has authenticated upload routes, private-R2 quarantine, Queue structural checks, Durable Object rate limiting and nonce replay protection.
- Queue validation checks object ownership metadata, size, namespace and PNG/JPEG/PDF magic bytes.
- Structurally valid files remain quarantined. There is no malware scanner, trusted release route, or public download route.
- The previous CI evidence is static/type/unit/dry-run evidence. It is not evidence of live Cloudflare Access, R2, Queue, or Durable Object behavior.

## Gate 0 — isolate staging before any deployment

Create and verify an isolated staging environment before running a live integration test:

- Separate Worker name (for example, `tlce-integration-api-staging`).
- Separate private R2 bucket (for example, `tlce-private-uploads-staging`).
- Separate Queue producer/consumer pair (for example, `tlce-file-inspection-staging`).
- Separate Durable Object namespaces/migrations for staging.
- Separate Cloudflare Access application/audience and staging origin allowlist.
- Staging-only R2 credentials and Worker secrets, with least privilege.
- A protected GitHub Actions environment named `cloudflare-staging`; secrets must be environment-scoped, not reused from production by default.

The staging configuration must not inherit production bucket names, queue names, Access audience, API keys, or release credentials. Do not use the existing manual deployment workflow for staging: it currently deploys the configured Worker name and is not a staging-isolation workflow.

**Stop condition:** if the account, staging resources, Access policy, or environment secrets are not configured and independently verified, do not deploy.

## Gate 1 — real Cloudflare integration tests

Run against staging only, using disposable test identities and synthetic files:

1. Access/JWKS: valid JWT accepted; wrong audience, issuer, signature, expiry and missing assertion rejected.
2. R2 direct PUT: exact signed headers accepted; altered headers/signature rejected; object remains private.
3. Upload completion: actual R2 size and metadata are checked; oversize or mismatched objects are deleted.
4. Worker-proxy upload: request byte limit and magic-byte checks occur before persistence.
5. Queue: message delivery, acknowledgement, retry, poison-message behavior and object deletion are observed in the real runtime.
6. Durable Objects: concurrent nonce replay has exactly one winner; expiry alarm cleanup is observed; rate-limit window behavior is verified.
7. CORS and origin checks: only the staging web origin is accepted.
8. Retention: staging-only scheduled cleanup removes expired quarantine objects and does not touch unrelated prefixes.

Record request IDs, timestamps, expected/actual status, object metadata and Queue outcomes. Never log file contents, credentials, JWTs, HMAC signatures or personal data.

## Gate 2 — select and integrate a real malware scanner

No scanner provider is selected by this change. Selection requires review of:
- Whether files leave the Cloudflare account and where they are processed.
- Data residency, retention, deletion, subprocessors and contractual/privacy terms.
- Maximum file size, supported formats, archive/decompression limits and timeout behavior.
- Authentication, rate limits, SLA, incident reporting and pricing.
- Whether a private self-hosted scanner endpoint is operationally supportable.

Implement a provider adapter only after the provider's documented API and data-processing terms are approved. The adapter contract must distinguish:
- `clean`: explicit, authenticated scanner verdict for the exact object digest.
- `infected`: confirmed malicious verdict; delete or retain in restricted forensic quarantine according to policy.
- `error` / `timeout` / `unknown`: fail closed; keep the object quarantined and retry with bounded backoff.

A timeout, malformed response, unsupported file type, scanner outage, or missing scanner configuration must never be interpreted as clean. Bind the verdict to the SHA-256 digest, object key, scanner engine/version and scan timestamp. Enforce upload-size, decompression and wall-clock limits. Do not send private files to public multi-scanner submission portals by default.

## Gate 3 — separately authorized release workflow

A clean verdict is necessary but not sufficient for release. The release path must:
- Require an authenticated server-side authorization decision and, for sensitive classes, an explicit human approval.
- Re-read the quarantine object and verify its digest still matches the scanner verdict.
- Copy the object to a separate private released bucket or isolated released prefix using a narrowly scoped release identity.
- Write immutable audit metadata: source key, destination key, digest, scanner engine/version, verdict, reviewer/authorization, timestamp and policy version.
- Prevent clients from setting `status=clean` or choosing a destination key.
- Keep release and scan operations idempotent; retries must not create duplicate release records.
- Expose no public bucket or unrestricted download URL. Any later download route must authorize the owner and issue a short-lived, content-disposition-safe URL.

No object is downloadable or processed as trusted until all gates pass.

## Gate 4 — acceptance and rollout

- Run the full repository CI and the dedicated staging integration suite.
- Review scanner failure, retry, duplicate message, stale verdict, digest mismatch and unauthorized release tests.
- Verify logs and metrics contain no secrets or file contents.
- Review data retention/deletion and incident-response procedures.
- Obtain explicit approval before production resource provisioning, deployment, DNS changes, paid service activation or enabling any user-facing release/download feature.

## Current blockers

- Staging Cloudflare account resources and Access policy are not verified in this repository session.
- A malware scanner provider and its privacy/retention terms have not been approved.
- A release authorization policy and reviewer role model have not been defined.
- Therefore, live staging tests and trusted-file release remain **not run / not enabled**.

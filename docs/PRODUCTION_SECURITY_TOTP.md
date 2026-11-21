# TLCE production TOTP and external security boundary

## Implemented in this branch

- RFC 6238 TOTP: SHA-1, six digits, 30-second period, at most one adjacent time step.
- Random 160-bit enrollment secret; enrollment remains pending until the user proves possession.
- TOTP seed is encrypted/decrypted only through the injected `TotpKms` adapter. PostgreSQL stores ciphertext and KMS key version, never plaintext seed material.
- PostgreSQL replay protection uses a conditional atomic update of `last_accepted_step`; a time step can be accepted once only, including across concurrent app instances.
- Privileged sessions remain behind the existing one-time MFA challenge. Challenge tokens are hashed at rest and attempts are atomically reserved in PostgreSQL.
- Enrollment URI and seed are returned only at enrollment time. They must not be logged, cached, sent to analytics, or stored in browser local storage.

## Mandatory external services before production

The repository intentionally does not select a cloud vendor or contain cloud credentials. The deployment owner must provision and inject:

1. **Managed KMS**: AWS KMS, Google Cloud KMS, Azure Key Vault Managed HSM, or an equivalent managed HSM-backed envelope-encryption service. Use a dedicated key for TLCE operator TOTP, disable key deletion without approval, enable rotation, audit decrypt operations, and grant decrypt permission only to the authentication workload. Implement `TotpKms` using the provider SDK and workload identity; do not use static long-lived cloud keys.
2. **PostgreSQL**: apply `003_totp_factors.sql` through the controlled migration pipeline. Require TLS with certificate validation, private networking, encrypted storage/backups, least-privilege database role, connection limits, PITR, and tested restore. Keep MFA factors and audit events out of analytics replicas.
3. **Distributed rate limiter**: inject an atomic shared limiter (Redis/managed equivalent) at the HTTP host boundary. Enforce independent limits by account/subject, source IP, and challenge; apply progressive cooldowns and alert on anomalous failure rates. The in-process challenge attempt cap is an additional control, not a substitute for distributed IP/account throttling.
4. **HTTP edge / host adapter**: enforce body-size limits before buffering (MFA verify <= 1 KiB), request/header count and size limits, reject duplicate Origin/Cookie/Content-Type/Authorization headers, enforce HTTPS and HSTS, trusted proxy configuration, secure cookie handling, and strip OAuth callback query strings and credentials from access/error logs.
5. **Secrets and runtime**: inject GitHub OAuth client secret and KMS identity via the platform secret manager/workload identity. Never commit credentials or place them in frontend bundles. Restrict egress to GitHub OAuth/API and the selected KMS endpoint.
6. **Observability and incident response**: log authentication outcomes with correlation IDs but never OTPs, TOTP seeds, OAuth codes/tokens, cookies, or full callback URLs. Alert on KMS failures, MFA failure spikes, replay attempts, rate-limit trips, and database errors. Define key compromise and operator lockout procedures.

## Required deployment configuration

- Configure an exact HTTPS callback URL and exact allowed console origins.
- Supply a production `TotpKms` implementation and `PostgresTotpFactorStore` instance to `KmsBackedTotpProvider`; inject that provider as the `TotpFactorVerifier` in `MfaChallengeService`.
- Do not enable privileged operator access if the KMS adapter, factor store, distributed rate limiter, or edge request protections are unavailable. Fail closed.
- Enforce mandatory TOTP enrollment for every privileged role before granting its first privileged session. Recovery must require a separately audited, strongly authenticated administrative procedure; do not add email/SMS fallback.
- Synchronize hosts with a trusted time source. Alert on clock drift; do not widen the TOTP acceptance window beyond one step.

## Security acceptance tests / release gates

- Validate RFC 6238 test vectors and invalid/expired codes.
- Verify a valid code can be accepted once and replay is rejected across concurrent instances.
- Verify pending enrollment cannot satisfy login MFA until confirmed.
- Verify ciphertext-only persistence and KMS context binding to the TLCE purpose and subject.
- Verify rate limits across multiple app replicas and across account/IP dimensions.
- Verify edge rejects oversized bodies and duplicate security-sensitive headers before route invocation.
- Verify logs and traces contain no secrets or callback query strings.
- Complete independent security review, migration rehearsal, KMS key recovery/rotation test, PostgreSQL restore test, and production rollback rehearsal.

## Status

This is an implementation and deployment contract, not proof of production readiness. No cloud provider, KMS key, Redis endpoint, production credentials, migration execution, DNS change, deployment, or production listener has been configured from this repository task. Keep PR #51 in Draft until the external services and host adapter are actually provisioned and independently verified.

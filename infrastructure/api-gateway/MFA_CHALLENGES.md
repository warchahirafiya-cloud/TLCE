# TLCE MFA challenge and TOTP security boundary

## Authentication flow

1. The trusted authentication layer resolves a pre-existing TLCE subject and its roles/module scope.
2. For privileged roles (`operator`, `maintainer`, `security_admin`), it calls `MfaChallengeService.begin`. The opaque challenge token is returned once; only its SHA-256 digest and server-derived authorization snapshot are persisted.
3. The host delivers the challenge token in a Secure, HttpOnly, host-only, short-lived cookie. It must not put the token in a URL, browser storage, logs, analytics, or a page referrer.
4. The host submits a six-digit TOTP response to `MfaChallengeService.complete`.
5. The service atomically reserves a bounded attempt, calls the TOTP verifier, atomically consumes the challenge, and only then creates the operator session.

## Implemented TOTP provider

- `KmsBackedTotpProvider` implements RFC 6238 using HMAC-SHA1, six digits, a 30-second step and a maximum ±1-step clock window.
- Enrollment generates a random 160-bit seed, stores only KMS ciphertext and key version, and remains pending until a valid code confirms possession.
- The seed is encrypted/decrypted through the injected `TotpKms` adapter with authenticated context binding to purpose and TLCE subject.
- `PostgresTotpFactorStore` stores ciphertext only. Atomic conditional updates to `last_accepted_step` reject replay, including simultaneous requests from separate application instances.
- The runtime can construct the provider directly when configured with `totpKms` and `totpIssuer`. The alternate `totpVerifier` injection exists for isolated tests; production must use the KMS-backed composition.

## External security dependencies still required

The repository does not select a cloud vendor or contain cloud credentials. Before production, the deployment owner must provision:

1. **Managed KMS/HSM** (AWS KMS, Google Cloud KMS, Azure Key Vault Managed HSM, or equivalent). Implement `TotpKms` with the vendor SDK and workload identity; do not use static long-lived cloud keys. Use a dedicated key, enable rotation and audit decrypt operations, and restrict decrypt permission to the authentication workload.
2. **PostgreSQL**: apply `infrastructure/persistence/postgres/migrations/006_totp_factors.sql` and the existing identity/MFA migrations through the controlled migration pipeline. Require TLS with certificate validation, private networking, encrypted storage/backups, least-privilege DB role, connection limits, PITR and tested restore.
3. **Distributed rate limiter**: inject an atomic shared limiter (Redis/managed equivalent) at the HTTP host boundary. Enforce independent limits by account/subject, source IP and challenge; apply progressive cooldowns and alert on anomalous failure rates. The MFA challenge attempt cap is additional protection, not a substitute.
4. **HTTP edge/host adapter**: enforce body-size limits before buffering (MFA verify <= 1 KiB), request/header count and size limits, reject duplicate/ambiguous Origin/Cookie/Content-Type/Authorization headers, enforce HTTPS/HSTS, configure trusted proxies, and strip OAuth callback query strings and credentials from access/error logs.
5. **Secrets/runtime**: inject GitHub OAuth client secret and KMS workload identity through the platform secret manager/workload identity. Never commit credentials or put them in frontend bundles. Restrict egress to GitHub OAuth/API and the selected KMS endpoint.
6. **Observability/incident response**: log outcomes with correlation IDs but never OTPs, TOTP seeds, OAuth codes/tokens, cookies or full callback URLs. Alert on KMS failures, MFA failure spikes, replay attempts, rate-limit trips and database errors. Define key compromise, operator lockout, factor reset and recovery procedures.

## Production fail-closed requirements

- Configure exact HTTPS callback URL and exact allowed console origins.
- Use the runtime's `totpKms` + `totpIssuer` composition, backed by `PostgresTotpFactorStore`; do not substitute a permissive verifier.
- Do not enable privileged operator access unless every privileged account has an active confirmed factor and KMS, PostgreSQL, distributed rate limiter and host protections are healthy.
- Recovery/factor reset must require a separately audited, strongly authenticated administrative procedure; no email/SMS fallback.
- Synchronize hosts with a trusted time source. Alert on clock drift; do not widen the acceptance window beyond one step.

## Security acceptance and release gates

- RFC 6238 test vectors, invalid/expired codes, pending-factor rejection and enrollment confirmation.
- A valid code can be accepted once; replay is rejected across concurrent app instances.
- Ciphertext-only persistence and KMS context binding to TLCE purpose and subject.
- Distributed limits tested across replicas and across account/IP dimensions.
- Edge rejects oversized bodies and duplicate security-sensitive headers before route invocation.
- Logs/traces contain no secrets or callback query strings.
- Independent security review, migration rehearsal, KMS key recovery/rotation test, PostgreSQL restore test and production rollback rehearsal.

## Status

TOTP algorithm, pending enrollment confirmation, KMS adapter contract, PostgreSQL ciphertext store, atomic replay protection, runtime composition and unit tests are implemented on the feature branch. This is not proof of production readiness: no cloud provider, KMS key, Redis endpoint, production credentials, migration execution, deployment, DNS change or production listener has been configured. Keep PR #51 in Draft until external services and the host adapter are provisioned and independently verified.

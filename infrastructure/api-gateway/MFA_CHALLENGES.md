# TLCE MFA challenge boundary

This module adds a server-side, one-time TOTP challenge service for privileged operator authentication.

## Flow

1. The trusted authentication layer resolves a pre-existing TLCE subject and its roles/module scope.
2. For privileged roles, it calls `MfaChallengeService.begin`. The opaque challenge token is returned once; only its SHA-256 digest and the server-derived authorization snapshot are persisted.
3. The host delivers the challenge token in a Secure, HttpOnly, host-only, short-lived cookie. It must not put the token in a URL, browser storage, logs, analytics, or a page referrer.
4. The host submits a six-digit TOTP response to `MfaChallengeService.complete`.
5. The service atomically reserves a bounded attempt, calls the injected TOTP verifier, atomically consumes the challenge, and only then creates the operator session.

## Mandatory production verifier requirements

The injected `TotpFactorVerifier` is a security boundary, not a placeholder to return `true`. A production implementation must:

- Load only an active, previously enrolled factor for the exact TLCE subject.
- Keep TOTP secrets encrypted at rest using KMS-backed envelope encryption; never store plaintext secrets in this challenge table or source control.
- Verify RFC 6238 TOTP with a narrow clock-skew window and constant-time comparison.
- Atomically reject reuse of an already accepted time-step.
- Apply subject-level throttling and alert on repeated failures.
- Fail closed when enrollment, decryption, KMS, replay state, or rate-limit dependencies are unavailable.

Do not supply a permissive verifier or infer MFA from OAuth profile data. Enrollment, recovery codes, factor reset, KMS implementation, HTTP delivery/verification routes, and production rate-limit integration remain separate work and must be reviewed before enabling privileged sign-in.

## Persistence

Apply migration `005_mfa_challenges.sql` through the approved migration runner. The PostgreSQL adapter uses parameterized statements, atomic attempt reservation, one-time deletion, and bounded expired-record cleanup. It does not provision a database or execute migrations.

## Status

The challenge engine and persistence contract are implemented as source and tests. No production verifier, factor enrollment, credentials, migration execution, listener, or deployment is configured by this change.

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

## OAuth and HTTP integration

The GitHub OAuth provider now branches by server-resolved role:

- `viewer` receives a normal operator session after successful OAuth.
- `operator`, `maintainer`, and `security_admin` receive a five-minute `__Host-tlce_mfa_challenge` cookie (Secure, HttpOnly, SameSite=Strict) and are redirected to the fixed local MFA page. No operator session is created at this point.
- `POST /auth/mfa/verify` requires an exact configured HTTPS Origin, JSON content type, a six-digit code, and the challenge cookie. On success it returns the operator session cookie and clears the challenge cookie using two separate Set-Cookie values.
- The MFA verification request body is capped at 1 KiB by this route. The host adapter must additionally enforce request-body limits before buffering, reject duplicate/ambiguous headers, and apply per-IP and per-subject rate limits.

The runtime now requires a `TotpFactorVerifier` dependency. It deliberately has no default implementation: runtime composition must fail to compile/configure without an explicit verifier. Do not use a permissive test verifier in production. The host must also provide a real enrollment lifecycle, encrypted factor store, replay prevention, and monitored rate limiting before enabling the route in a public environment.

The MFA cookie is scoped to `Path=/` so the verification endpoint receives it. It is not a session credential and cannot access the developer console gateway.

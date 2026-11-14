# TLCE Identity and Authorization Boundary

## Implemented

- Provider-neutral `IdentityTokenVerifier` adapter contract.
- Bearer token boundary that delegates cryptographic verification to the injected adapter and fails closed on errors.
- Post-verification claim validation for subject, issuer, audience, expiry, not-before, tenant ID and bounded capabilities.
- Tenant-scoped authorization requiring both an exact tenant match and an explicit capability.
- No wildcard capabilities; missing or malformed identity is denied.

## Security boundary

`toIdentityPrincipal` accepts claims only after a trusted verifier has cryptographically validated the token signature and relevant JWT/OIDC properties. It is a claim validator, not a JWT decoder or signature verifier. Never implement production authentication by base64-decoding a JWT.

The production adapter must validate allowed algorithms, issuer, audience, expiry, not-before, key ID and signature against trusted JWKS; safely cache and rotate keys; reject algorithm/key confusion; and enforce TLS. The identity provider's client secrets and signing material belong in a managed secret store, never source control.

## Integration gates before production

1. Select and configure a trusted OIDC identity provider and register TLCE API audiences/clients.
2. Implement and security-review its `IdentityTokenVerifier` adapter.
3. Add the HTTP edge adapter that extracts authorization headers and constructs a principal only through `authenticateBearerToken`.
4. Pass tenant context from verified claims, never from untrusted request bodies or query parameters.
5. Persist role/capability grants with audit history and administrative controls.
6. Add rate limits, session/token revocation strategy, monitoring and security incident alerts.

The current in-process gateway accepts a principal from its caller for contract tests; it is not an internet-facing authentication boundary. Do not expose it publicly until the verified adapter is wired at the trusted edge.

## Verification

Run `npm test` and `npm run typecheck`. CI success validates code contracts only; it does not provision an identity provider or activate production authentication.

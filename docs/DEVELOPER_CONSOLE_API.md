# TLCE Developer Console API Contract

Status: implementation contract for the private control plane; production endpoints are not deployed.

## Trust model

The browser is an untrusted client. The API server must authenticate the session before constructing a `VerifiedOperatorContext`. Never accept subject, roles, module scope, capabilities or permissions from request JSON, query parameters, browser storage or custom headers.

The current `DeveloperConsoleService` is a server-side read service, not an HTTP listener or an authentication provider. Every call requires a server-verified operator context. It writes an audit event before returning protected data and fails closed if audit persistence fails.

## Identity provider integration

GitHub is an external sign-in provider only. GitHub account ownership does not grant a TLCE role.

- Implement the GitHub OAuth authorization-code flow in a trusted server adapter. Validate a one-time `state`, exact registered redirect URI, authorization-code exchange, and use PKCE only where supported by the selected GitHub OAuth integration.
- Keep the OAuth client secret in runtime secret storage. Never place it in browser code, Git, or GitHub Pages.
- After code exchange, call GitHub's authenticated user API from the server and use its stable numeric account `id` as the external account key. Do not use `login`, display name, email, or avatar as the identity key.
- Resolve that external account ID against an explicit, pre-existing TLCE account-link record. Unknown accounts are denied; do not auto-provision operators or infer roles from GitHub organization membership.
- Resolve TLCE subject, roles, module scope and MFA/assurance requirements from TLCE's server-side identity and policy stores.
- GitHub OAuth is OAuth 2.0, not an OIDC identity-token flow. Do not treat GitHub OAuth access tokens as OIDC ID tokens or apply OIDC issuer/audience/JWKS checks to them.
- A future standards-based OIDC provider may use the separate OIDC flow below, with issuer, audience, signature, nonce and PKCE validation as required by that provider.

The `core/identity/src/external-identity.ts` resolver accepts only a provider-verified stable account identifier and an existing TLCE link. It does not perform the OAuth exchange, verify GitHub responses, create users, or assign roles.

## Session

The new `OperatorSessionService` provides the session lifecycle core in
`core/identity/src/operator-session.ts`:

- Generates opaque 256-bit URL-safe session and CSRF tokens.
- Persists only SHA-256 token digests through an injected `OperatorSessionStore`.
- Resolves roles and module scope only from the server-created session record.
- Rotates CSRF tokens, validates them using constant-time digest comparison,
  enforces idle and absolute expiry, and supports revocation.
- Builds the host-only `__Host-tlce_session` cookie with Secure, HttpOnly,
  Path=/ and SameSite=Lax attributes.

The session-store contract now has a PostgreSQL adapter at
`infrastructure/persistence/postgres/src/postgres-operator-session-store.ts`,
with schema migration `001_operator_sessions.sql` and adapter tests. The
adapter accepts only token digests, uses parameterized SQL, validates persisted
roles/scope, and supports bounded expiry cleanup. It is not yet wired into a
deployed runtime: database provisioning, TLS-verified connection configuration,
migration execution, least-privilege credentials, scheduled cleanup, backup/
restore validation and operational monitoring remain required before production.

- Session cookie: `__Host-tlce_session`, Secure, HttpOnly, Path=/, SameSite=Lax, short-lived and rotated after authentication/privilege changes.
- `GET /api/tlce/control-plane/session`: return `{ authenticated: true, operator: { displayName, roles }, csrfToken }` or HTTP 401. Do not return session IDs, access tokens, refresh tokens or internal permission grants.
- `POST /auth/logout`: require a valid CSRF token, revoke the server-side session, clear the cookie and return HTTP 204.
- MFA must be enforced for privileged roles by a provider and assurance mechanism that TLCE can verify. A GitHub login alone must not satisfy TLCE's privileged-role MFA requirement unless a separately verified assurance signal is available.

## Read endpoints

All endpoints require a valid session cookie. The server resolves the operator context and authorizes each request independently.

### `GET /api/tlce/control-plane/overview`

Requires `control-plane.overview:read`. Returns only aggregate counts:

```json
{
  "registeredModules": 0,
  "readyModules": 0,
  "degradedModules": 0,
  "failedModules": 0
}
```

### `GET /api/tlce/control-plane/modules`

Requires `modules.registry:read`. Returns only modules inside the operator's server-side `allowedModuleIds` scope:

```json
{
  "modules": [
    {
      "moduleId": "quest-pulse",
      "displayName": "QuestPulse",
      "version": "0.1.0",
      "state": "ready"
    }
  ]
}
```

The current UI is intentionally read-only. Lifecycle controls, grant editing, security-policy mutation, user management and secret management are not exposed.

## Role policy

Roles map to explicit resource/action pairs in `core/identity/src/operator-authorization.ts`. No wildcard permissions exist.

| Role | Intended access |
| --- | --- |
| viewer | Read overview, module registry within assigned scope, and audit records |
| operator | Viewer plus start/stop module lifecycle within assigned scope |
| maintainer | Operator plus read/write access grants and read security policy |
| security_admin | Read/write security policy and grants; no implicit module lifecycle access |

The first UI release only uses overview and registry read permissions. The wider role policy is defined centrally for later audited operations, not exposed by the browser.

## Mandatory server controls

- Enforce TLS and trusted proxy configuration.
- For OIDC providers, use Authorization Code + PKCE, state/nonce validation, issuer/audience restrictions and maintained JWT/JWKS verification.
- For GitHub OAuth, use server-side OAuth code exchange, state validation, exact redirect URI matching and provider API identity verification; do not pretend it is OIDC.
- Store opaque sessions server-side; rotate and revoke them; enforce idle and absolute expiry.
- Apply CSRF protection to every state-changing request and Origin/Referer validation as defense in depth.
- Apply per-session and per-IP rate limits, strict input schemas, request size limits and safe error responses.
- Derive roles and module scope from server-side policy, never from browser input or untrusted provider profile fields.
- Audit privileged reads and all writes. If the audit sink is unavailable, fail closed.
- Keep credentials in managed runtime secrets. Never commit OAuth client secrets, signing keys or session secrets.
- Deploy this UI and API on a protected server-side host, separate from GitHub Pages.

## Deployment boundary

The public Pages workflow must continue uploading only `apps/web`. Do not add `apps/developer-console` to the Pages artifact. No public URL should serve this UI until the protected host, authentication provider, persistent sessions, API enforcement, audit sink and security tests are ready.

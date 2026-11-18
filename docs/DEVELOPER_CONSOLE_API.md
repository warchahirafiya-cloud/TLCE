# TLCE Developer Console API Contract

Status: implementation contract for the private control plane; production endpoints are not deployed.

## Trust model

The browser is an untrusted client. The API server must authenticate the session before constructing a `VerifiedOperatorContext`. Never accept subject, roles, module scope, capabilities or permissions from request JSON, query parameters, browser storage or custom headers.

The current `DeveloperConsoleService` is a server-side read service, not an HTTP listener or an authentication provider. Every call requires a server-verified operator context. It writes an audit event before returning protected data and fails closed if audit persistence fails.

## Authentication and session

- `GET /auth/login`: begin OIDC Authorization Code flow with PKCE and state/nonce validation.
- `GET /auth/callback`: validate issuer, audience, signature, nonce, state and authorization-code exchange server-side; resolve TLCE roles and module scopes from a trusted server-side mapping.
- Session cookie: `__Host-tlce_session`, Secure, HttpOnly, Path=/, SameSite=Lax, short-lived and rotated after authentication/privilege changes.
- `GET /api/tlce/control-plane/session`: return `{ authenticated: true, operator: { displayName, roles }, csrfToken }` or HTTP 401. Do not return session IDs, access tokens, refresh tokens or internal permission grants.
- `POST /auth/logout`: require a valid CSRF token, revoke the server-side session, clear the cookie and return HTTP 204.
- MFA must be enforced by the identity provider for privileged roles. The API must verify the required authentication assurance level before granting those roles.

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
- Use OIDC Authorization Code + PKCE, state/nonce validation, issuer/audience restrictions and maintained JWT/JWKS verification.
- Store opaque sessions server-side; rotate and revoke them; enforce idle and absolute expiry.
- Apply CSRF protection to every state-changing request and Origin/Referer validation as defense in depth.
- Apply per-session and per-IP rate limits, strict input schemas, request size limits and safe error responses.
- Derive roles and module scope from server-side policy, never from client claims without an explicit trusted mapping.
- Audit privileged reads and all writes. If the audit sink is unavailable, fail closed.
- Keep credentials in managed runtime secrets. Never commit OIDC client secrets or signing keys.
- Deploy this UI and API on a protected server-side host, separate from GitHub Pages.

## Deployment boundary

The public Pages workflow must continue uploading only `apps/web`. Do not add `apps/developer-console` to the Pages artifact. No public URL should serve this UI until the protected host, authentication provider, persistent sessions, API enforcement, audit sink and security tests are ready.

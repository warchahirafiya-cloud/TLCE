# TLCE authentication and authorization model

This project already has two separate authentication paths. Do not add a browser login endpoint that returns a Worker secret, and do not put any HMAC key in GitHub Pages.

## Browser users: Cloudflare Access

The browser-facing identity provider is Cloudflare Access. The Worker validates the Access JWT signature using the Access JWKS endpoint and checks:

- RS256 signature and key ID;
- issuer matches `CF_ACCESS_TEAM_DOMAIN`;
- audience matches `CF_ACCESS_AUD`;
- expiry and not-before timestamps;
- non-empty subject claim;
- future-issued `iat` values are rejected;
- after signature verification, the Worker exposes only signed identity claims (`sub`, bounded `email`, and bounded `name/common_name`) to application code. The stable `sub` remains the rate-limit and ownership principal.

Email and display name are identity attributes, not administrator privileges. They must not be used as an authorization decision unless an explicit server-side allowlist or role mapping is added.

Protected API handlers call `requireIdentity()`. This applies to search, AI chat, presigned upload creation, upload completion and Worker-proxy upload. Every authenticated principal is also subject to the Durable Object rate limiter (20 requests per minute).

The browser uses its Access-authenticated session/cookie flow. Do not issue a custom TLCE bearer token from a public login route and never return `TLCE_API_KEYS_JSON`, R2 credentials, AI provider keys, or any other Worker secret.

## Trusted server-to-server callers: HMAC request signing

The existing HMAC-SHA256 implementation is intentionally separate from browser sessions.

- Key material is stored only in the Worker secret `TLCE_API_KEYS_JSON`, indexed by key ID.
- Each key must decode from base64url to at least 32 random bytes.
- Signatures bind method, path/query, timestamp, unique nonce and SHA-256 digest of the exact request body.
- Timestamp skew is limited to five minutes.
- Nonces are consumed atomically through the Durable Object to prevent replay. Each nonce uses its own storage key with a 600-second storage TTL; there is no bounded 256-entry list that can evict a still-live nonce under high request volume.
- HMAC callers are scoped to `POST /api/files/presign` and `POST /api/files/complete`; HMAC does not grant access to AI chat, search or proxy upload.
- HMAC-authenticated requests are also rate-limited by principal.

Never move this secret into a browser bundle, public repository, mobile app, or local storage. A client-side HMAC secret is not secret.

## Authorization and roles

Authentication establishes identity; authorization determines what that identity may do. The current Worker treats any user admitted by the Cloudflare Access application policy as an authenticated user for the protected routes. The Access application policy is therefore the current browser admission boundary.

There is not yet an application-level role/permission matrix or an admin-only route. Do not imply that an arbitrary Access-authenticated user is an application administrator. Before adding admin capabilities, define the authorized administrator identities and the exact actions/permissions, then enforce those roles server-side using verified Access claims or a server-managed identity/role store. Never trust a role, email, username, or permission supplied only in request JSON or browser state.

## Session and account security

- Configure Cloudflare Access session duration and identity-provider MFA in the Cloudflare Zero Trust dashboard.
- Restrict the Access application to explicitly approved identities/groups; do not use an unrestricted email-domain rule unless that is the intended policy.
- Keep the Worker hostname behind the Access application and verify the Access JWT on every protected request.
- Use HTTPS only and keep CORS restricted to the exact production origin.
- Rotate HMAC keys by introducing a new key ID, migrating trusted backend callers, then removing the old key.
- Keep rate limiting enabled and monitor 401, 403, 429 and 503 responses.
- Do not store bearer credentials or HMAC secrets in browser localStorage/sessionStorage.

## Deliberately not implemented

No `/api/auth/login` route, `ADMIN_USER`, `ADMIN_PASS`, or custom bearer-session issuer is added. The suggested pattern that compares a submitted password with a Worker secret and returns `API_SECRET_KEY` would disclose a global credential to the browser; it is not a secure HMAC session design.

No role identities were invented for this project. An application-level RBAC layer requires an explicit administrator allowlist/group and a permission matrix before it can be safely enabled.

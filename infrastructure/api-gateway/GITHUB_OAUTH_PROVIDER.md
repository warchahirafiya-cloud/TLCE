# GitHub OAuth Provider Adapter

Status: server-side authorization-code adapter; not yet mounted into the HTTP gateway or deployed.

## Flow

1. `start()` creates a short-lived one-time OAuth state transaction and returns the GitHub authorization URL.
2. GitHub redirects to the exact configured HTTPS callback URI.
3. `complete({ code, state })` consumes the state before making provider requests.
4. The server exchanges the authorization code using the confidential client credentials.
5. The server fetches `GET https://api.github.com/user` and accepts only the stable positive numeric account ID.
6. The ID must resolve to an existing active TLCE account link.
7. TLCE's policy resolver supplies roles and module scope. Privileged roles require a separately verified MFA challenge in the current authentication.
8. A server-side operator session is created; only its cookie is returned to the HTTP adapter.

## Security and integration requirements

- Inject credentials from managed runtime secret storage; never commit them or expose them to browser code.
- Inject an HTTP client with TLS certificate verification, strict timeouts, bounded response sizes and redirect handling that does not forward Authorization headers to another origin.
- Apply rate limits to start and callback routes and return generic errors to browsers.
- The adapter does not persist GitHub access tokens and does not return them.
- GitHub OAuth is OAuth 2.0, not OIDC. Do not treat the access token as an ID token.
- No PKCE claim is made here; use only provider-supported controls and retain strict one-time state validation.
- The adapter does not implement the TLCE MFA challenge. The policy resolver must return `mfaVerifiedForThisAuthentication: true` only after a separate trusted TLCE MFA mechanism succeeds.
- The callback route, provider registration, exact redirect URI, production secrets, database wiring and session cookie response must be configured by a trusted server host before enabling sign-in.

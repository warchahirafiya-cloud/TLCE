# TLCE Developer Console API Gateway

Status: framework-neutral API boundary; not yet mounted on a production HTTP server.

## Routes

- `GET /api/tlce/control-plane/session`: resolves the host-only session cookie and returns the authenticated subject, roles and a CSRF token. It never returns the session token.
- `GET /api/tlce/control-plane/overview`: invokes the audited control-plane overview service.
- `GET /api/tlce/control-plane/modules`: returns only modules within the session's explicit module scope.
- `POST /auth/logout`: requires an exact configured HTTPS Origin and a valid `x-tlce-csrf` token, revokes the server session and clears the cookie.

## Integration contract

Mount `DeveloperConsoleGateway.handle` inside a trusted server framework adapter. Convert framework requests to `GatewayRequest` and write the returned status, headers and body to the HTTP response. Do not expose this class or PostgreSQL executors in browser bundles.

Configure exact production HTTPS origins. The `__Host-` cookie requires HTTPS, Path=/, Secure, HttpOnly and no Domain attribute. Add trusted-proxy configuration, request-size limits, rate limiting, security headers, structured server-side error logging and graceful shutdown in the hosting adapter.

## Deliberate exclusions

No OAuth callback, provider token exchange, identity-link administration, MFA verification, login endpoint, database pool construction or production listener is included. Those require a separately reviewed provider/hosting integration and real runtime secrets. Do not auto-provision operator accounts or infer TLCE roles from provider profile data.

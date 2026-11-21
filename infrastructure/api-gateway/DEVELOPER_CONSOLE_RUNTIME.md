# TLCE Developer Console Runtime Composition

Status: composed application factory; not a network listener and not deployed.

## Composition

`createTlceDeveloperConsoleRuntime` wires:

- PostgreSQL operator session store and `OperatorSessionService`
- PostgreSQL one-time OAuth transaction store and `OAuthTransactionService`
- PostgreSQL external-account link lookup
- PostgreSQL audit sink and `DeveloperConsoleService`
- GitHub OAuth provider adapter and start/callback route handlers
- Private developer-console API gateway

The factory exposes one `handle(request)` method. The host HTTP server dispatches incoming requests to it and serializes the returned status, headers and body.

## Required host configuration

- A TLS-verified PostgreSQL Pool/Client with migrations 001–004 already applied.
- GitHub OAuth client ID/secret injected from managed runtime secrets.
- An exact registered HTTPS callback URI.
- Exact HTTPS browser origins.
- A trusted GitHub account-link lookup and server-side TLCE policy resolver.
- A separately verified MFA challenge for every privileged role.
- HTTP timeouts, bounded response sizes, trusted proxy validation, per-IP/session rate limiting, access-log redaction for OAuth query strings, security headers and graceful shutdown.
- Database least-privilege grants, backups, monitoring and scheduled expired-session cleanup.

The factory opens no port, performs no migration, provisions no database and changes no DNS or deployment settings. Do not mount it on GitHub Pages or expose it publicly until the host security controls and end-to-end tests are complete.

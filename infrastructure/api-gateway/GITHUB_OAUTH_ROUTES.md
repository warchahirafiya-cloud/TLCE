# GitHub OAuth HTTP Routes

Status: minimal server-side route adapter; not yet mounted on a deployed HTTP listener.

## Routes

- `GET /auth/github/start`: creates the one-time state transaction and redirects to the GitHub authorization URL.
- `GET /auth/github/callback`: accepts exactly one `code` and one `state`, delegates verification/exchange to `GitHubOAuthProvider`, sets the host-only session cookie and redirects to a fixed local success path.

The callback never reflects provider error details, authorization codes, state values or access tokens. It rejects duplicate query parameters. The success redirect is configured server-side and cannot be supplied by the browser.

## Host adapter requirements

Dispatch these routes before the general developer-console gateway. Mount them only on the protected HTTPS host that matches the registered callback URI. Apply per-IP and per-session rate limits, request timeouts and bounded query/header sizes. Use a strict Content-Security-Policy and do not log callback query strings. Configure reverse proxies to redact `code` and `state` from access logs.

The adapter does not handle provider-denial state cleanup, CSRF for other state-changing routes, login throttling or production server wiring. The OAuth state remains short-lived and expires automatically if the user denies consent or abandons the flow.

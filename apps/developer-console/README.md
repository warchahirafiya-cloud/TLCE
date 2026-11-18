# TLCE Developer Console

This is the private operator UI for the TLCE parent platform. QuestPulse remains an internal TLCE module.

## Isolation

- This directory is deliberately separate from `apps/web`.
- The GitHub Pages workflow uploads only `apps/web`; it must never be changed to upload this directory.
- Do not publish this app as a public static site. Its production host must sit behind the TLCE authenticated control-plane server.
- The source repository is public, so this UI contains no secrets and is not itself an access-control boundary.

## Server API contract

The UI expects the authenticated same-origin endpoints documented in `docs/DEVELOPER_CONSOLE_API.md`:
- `GET /api/tlce/control-plane/session`
- `GET /api/tlce/control-plane/overview`
- `GET /api/tlce/control-plane/modules`
- `POST /auth/logout`

The server must own OIDC login/callback, session creation and revocation, secure HttpOnly cookies, CSRF validation, role resolution, module scoping, authorization, rate limiting and audit persistence. The browser never supplies roles or permissions as authority.

## Current status

The UI and the server-side audited read service are implemented as foundations. A production HTTP server, OIDC provider adapter, persistent session store, persistent audit sink and protected deployment are not present yet. Until those exist and pass integration/security tests, the console intentionally displays an unavailable state and must not be treated as a working production admin system.

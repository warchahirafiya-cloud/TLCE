# TLCE LLM7 Chat UI

## Components

- UI: `apps/llm7-chat/index.html` (static, responsive, no browser-side SDK dependency).
- Proxy: `infrastructure/serverless-edge/llm7-chat/handler.ts`.
- Tests: `infrastructure/serverless-edge/llm7-chat/handler.test.ts`.

The browser sends conversation messages to the same-origin `POST /api/llm7/chat` route. The proxy calls `https://api.llm7.io/v1/chat/completions` using a server-side bearer token and the configured model (default: `default`).

## Required server environment

- `LLM7_API_KEY`: required secret from the LLM7 dashboard.
- `LLM7_BASE_URL`: optional; defaults to `https://api.llm7.io/v1`.
- `LLM7_MODEL`: optional; defaults to `default`.

Never place `LLM7_API_KEY` in HTML, JavaScript bundles, public environment variables, source control, or client storage.

## Mounting the handler

Mount `createLlm7ChatHandler(env)` at `POST /api/llm7/chat` in the selected edge adapter. Keep the UI and endpoint on the same origin. The route must be placed behind TLCE identity/authentication and per-user/IP rate limiting before public exposure. Apply provider spending limits and request quotas as well.

The handler validates method, content type, declared request size, message count, message length, and role alternation. It does not implement identity, rate limiting, persistent conversation storage, streaming, or a provider-specific timeout. Those are deployment adapter responsibilities and remain required before production.

## Local verification

Run:

```sh
npm test
npm run typecheck
```

## Deployment status

This is an integration-ready UI and provider proxy handler, not a deployed service. Configure the secret in the hosting platform's secret manager, mount the route, serve the static UI, and verify authentication/rate limiting before enabling public traffic. No secret is required to run the unit tests.

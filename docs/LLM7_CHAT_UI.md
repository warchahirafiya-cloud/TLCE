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

Mount `createLlm7ChatHandler(env, fetchImpl, security)` at `POST /api/llm7/chat` in the selected edge adapter. `security` is required: it must provide `authenticate(request)` using server-verified credentials and `allowRequest(request)` using a shared server-side rate limiter. If this policy is omitted, the handler deliberately returns `503` and fails closed. Do not use permissive placeholder callbacks in production. Keep the UI and endpoint on the same origin, and apply provider spending limits and request quotas as well.

The handler invokes the supplied authentication and rate-limit policies before contacting the provider, then validates method, origin, content type, request size, message count, message length, and role alternation. It does not implement identity verification, the shared rate limiter, persistent conversation storage, streaming, or a provider-specific timeout. The hosting adapter must supply the first two controls and configure provider quotas/timeouts before production.

## Local verification

Run:

```sh
npm test
npm run typecheck
```

## Deployment status

This is an integration-ready UI and provider proxy handler, not a deployed service. Configure the secret in the hosting platform's secret manager, mount the route with real server-verified authentication and a shared rate limiter, serve the static UI, and verify the complete request path before enabling public traffic. The repository currently contains no deployed edge adapter or production route binding. No secret is required to run the unit tests.

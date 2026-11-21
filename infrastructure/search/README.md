# TLCE Search Engine

A provider-neutral, server-side multi-search foundation for TLCE.

## Current adapters

- **DuckDuckGo Instant Answer API** — public, keyless fallback. It is an instant-answer/related-topic source, not a complete web index.
- **Wikipedia OpenSearch** — public, keyless reference search.
- **Brave Search API** — optional keyed web-search provider. It is skipped unless a server-side `BRAVE_SEARCH_API_KEY` is configured.

Results are normalized, HTTPS-only, deduplicated and bounded. Provider failures degrade independently rather than failing the whole search response.

## Server integration

Use `createSearchHandler` from a trusted server/edge runtime and provide:
- `BRAVE_SEARCH_API_KEY` from the host secret manager (optional);
- a trusted `authenticate(request)` implementation based on verified TLCE identity;
- a shared server-side `allowRequest(request)` rate limiter;
- optional `enablePublicProviders`, `maxResults` and `timeoutMs` configuration.

The handler fails closed with HTTP 503 until the host supplies identity and rate-limit controls. Do not expose provider keys to browser code, static Pages assets, query strings, logs or client-visible configuration. Do not use origin checks as authentication.

## Cost and activation policy

Public fallback adapters are keyless. Brave is disabled by default and incurs no provider calls until a key is deliberately configured. The repository contains no provider credentials and provisions no paid account or cloud resource. Obtain explicit owner approval before adding a paid key, plan, billing method or production deployment.

## Validation

Run `npm test` and `npm run typecheck`. Tests use mocked provider responses and do not make external requests.

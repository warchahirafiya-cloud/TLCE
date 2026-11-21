# TLCE Production Integration Worker

This is the first deployable server-side runtime for TLCE. It exposes:
- `GET /health`: non-sensitive liveness status.
- `GET /api/search?q=...`: authenticated hybrid search using DuckDuckGo/Wikipedia and optional Brave.

## Security
- Search requests require a valid Cloudflare Access JWT in `Cf-Access-Jwt-Assertion`.
- JWT signature, issuer, audience, expiry and subject are validated using the Cloudflare Access JWKS.
- Per-subject rate limiting is enforced by a SQLite-backed Durable Object (20 requests/minute).
- Browser CORS is restricted to `https://tlce.store`.
- Provider keys are server-side Worker secrets only.
- Health output deliberately reveals no configuration or credential state.

## Required Cloudflare configuration
1. Create a Cloudflare Worker-compatible account and activate the free plan only; do not enable paid features.
2. Create an Access application for the Worker hostname, with the intended user identity policy.
3. Set GitHub Actions repository secrets:
   - `CLOUDFLARE_API_TOKEN`: scoped to this account and Worker deployment only.
   - `CLOUDFLARE_ACCOUNT_ID`.
   - `CF_ACCESS_TEAM_DOMAIN`: the tenant hostname, without scheme.
   - `CF_ACCESS_AUD`: the Access application's audience tag.
4. Optionally set `BRAVE_SEARCH_API_KEY` as a Worker secret only if a Brave account/key is separately approved.
5. Run the `Deploy TLCE Integration Worker` workflow manually.

Do not put any of these values in source code, website assets, or frontend environment variables. The workflow fails closed when required deployment or Access settings are absent.

## Deployment and domain
The first deployment uses the Worker `workers.dev` hostname. Connecting a custom `api.tlce.store` hostname requires an active Cloudflare zone and DNS configuration. Do not change Namecheap nameservers or existing DNS records as part of this scaffold.

## Deliberate scope boundary
LLM7 is not enabled by this Worker yet. Its provider endpoint, model identifier, account credentials, billing status and supported authentication contract must be verified before a production proxy is exposed. This avoids sending user prompts to an unverified endpoint or incurring unapproved charges.

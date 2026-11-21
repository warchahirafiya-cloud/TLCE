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
- If Access identity or rate limiting is not configured, search fails closed.

## Zero-cost-first deployment

The intended starting point is the Cloudflare Workers Free plan. Cloudflare currently includes SQLite-backed Durable Objects on Free, subject to daily request, CPU and storage quotas. Exceeding free quotas causes requests/operations to be rejected rather than requiring an automatic upgrade. Do not enable Workers Paid or add paid products without separate approval.

### Stage 1 — Deploy a safe Worker

1. Create/sign in to a Cloudflare account and keep Workers on the Free plan.
2. Create a Cloudflare API token scoped to the account with permission to deploy Workers scripts and Durable Object bindings.
3. Add GitHub repository Actions secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Run the `Deploy TLCE Integration Worker` workflow manually.
5. The Worker is created on its `workers.dev` hostname. The public `/health` endpoint works; protected search deliberately returns 503 until Access is configured.

### Stage 2 — Enable identity protection

1. In Cloudflare Dashboard, open Workers & Pages and select `tlce-integration-api`.
2. Open Settings > Domains & Routes (or the Access tab) and enable Cloudflare Access for the Worker's production `workers.dev` URL. Choose an Allow policy limited to the user's intended email identity.
3. Open the Worker's Access application and copy its audience tag. Find the account's Access team domain (for example, `your-team.cloudflareaccess.com`).
4. Add GitHub Actions repository secrets:
   - `CF_ACCESS_TEAM_DOMAIN`: tenant hostname only, without `https://`.
   - `CF_ACCESS_AUD`: the Worker's Access application audience tag.
5. Rerun `Deploy TLCE Integration Worker`. The workflow stores these as Worker secrets and redeploys.

### Optional search provider

Only if separately approved, add `BRAVE_SEARCH_API_KEY` as a GitHub Actions repository secret. DuckDuckGo and Wikipedia adapters require no provider key. Do not add any key to frontend code or the repository.

## Domain and frontend

The first deployment uses the `workers.dev` hostname and does not require changing Namecheap DNS or nameservers. Cloudflare recommends a custom domain or route for business-critical production; attaching `api.tlce.store` later requires an active Cloudflare zone and a separate DNS decision. Do not change existing DNS as part of this setup.

Do not connect the frontend until the deployed Worker URL and Cloudflare Access browser authentication/CORS behavior are verified. The current site is static GitHub Pages and cannot safely store provider secrets.

## Deliberate scope boundary

LLM7 is not enabled by this Worker yet. Its provider endpoint, model identifier, account credentials, supported authentication contract and billing status must be verified before a production proxy is exposed. This avoids sending user prompts to an unverified endpoint or incurring unapproved charges.

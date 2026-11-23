# TLCE Serverless Integration Worker

Cloudflare-first runtime for the TLCE public site. The static GitHub Pages frontend never receives provider credentials.

## Routes

- `GET /health` — non-sensitive liveness.
- `GET /api/search?q=...` — Cloudflare Access authenticated search.
- `POST /api/ai/chat` — Cloudflare Access authenticated LLM proxy.
- `POST /api/files/upload` — authenticated upload to private R2 quarantine. Returns `202`; this is **not** a malware-clean verdict.
- Cron: every six hours, optionally dispatches a configured automation webhook.

All protected routes use the existing Cloudflare Access JWT verification and Durable Object rate limiter (20 requests/minute/subject). CORS remains restricted to `https://tlce.store`.

## AI providers

Default: Cloudflare Workers AI through the `AI` binding. The Free plan currently includes a daily free Neurons allocation; requests fail when quota is exhausted. See Cloudflare's current pricing before enabling paid usage.

Optional providers (choose one by setting `AI_PROVIDER`):
- `workers-ai` — default, no provider API key.
- `groq` — uses `openai/gpt-oss-120b`; set `GROQ_API_KEY` as a Worker secret.
- `gemini` — set `GEMINI_API_KEY` as a Worker secret.

Do not send sensitive or confidential prompts to third-party providers unless the data-processing implications have been reviewed. Provider selection is an operator setting, not a browser-controlled parameter. No automatic cross-provider fallback is performed.

## R2 upload quarantine — important limitation

Create a **private** R2 bucket named `tlce-private-uploads` and bind it as `UPLOADS`. Do not enable public bucket access or expose an R2.dev domain.

The endpoint:
1. Requires a valid Cloudflare Access JWT.
2. Enforces a 5 MiB maximum and accepts only PNG/JPEG/PDF signatures.
3. Generates a random object key and stores the object under `quarantine/`.
4. Sets `application/octet-stream` and metadata `status=quarantined`, owner hash and SHA-256.

There is deliberately no download/release endpoint. MIME/signature checks are **not antivirus scanning**. A file remains untrusted and unavailable until a real AV scanner has inspected it and a separately authorized release workflow is implemented.

Practical options:
- For a production-grade edge upload inspection feature, Cloudflare WAF Malicious Uploads Detection is an Enterprise paid add-on.
- For a low-cost design, keep R2 private and quarantine-only until a trusted external scanning service is selected and its privacy/retention/API terms are approved. Do not upload private user files to public malware-analysis services by default.
- R2 Event Notifications can later route object-create events to a Cloudflare Queue consumer for asynchronous scanning. The scanner still needs to be an actual AV service; the queue itself does not scan.

## Automation without n8n

Use the Worker's Cron Trigger for simple periodic tasks and authenticated HTTP routes for event/webhook triggers. The included six-hour cron is inert unless both `AUTOMATION_WEBHOOK_URL` and `AUTOMATION_WEBHOOK_SECRET` are configured as Worker environment values/secrets. It sends only the cron name and scheduled timestamp.

For multi-step retries, branching, human approvals, or complex visual workflows, n8n Cloud or a separately hosted n8n instance remains an optional later integration. Do not run n8n inside this Worker.

## Configure secrets

Set these through Wrangler secrets or the Cloudflare dashboard; never commit them:

```sh
npx wrangler secret put CF_ACCESS_TEAM_DOMAIN
npx wrangler secret put CF_ACCESS_AUD
# Optional, only for the selected provider:
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GEMINI_API_KEY
# Optional scheduled webhook:
npx wrangler secret put AUTOMATION_WEBHOOK_SECRET
```

The existing GitHub Actions deployment workflow may also provision the Access secrets. Do not create duplicate secret sources without checking the workflow first.

## Local validation and deployment

```sh
npx wrangler dev
npx wrangler deploy
```

Before deployment:
1. Create the private R2 bucket `tlce-private-uploads`.
2. Confirm the Worker AI binding is enabled for the account.
3. Configure Cloudflare Access on the Worker hostname and verify the browser authentication flow.
4. Add only the secret for the chosen AI provider.
5. Test invalid JWT, rate limit, oversized upload, disallowed file type, and provider failure.
6. Verify R2 objects are not publicly accessible.

Deployment is not performed by this change. Keep the Worker on the Free plan; do not enable paid products without separate approval.

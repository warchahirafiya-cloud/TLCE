# TLCE Serverless Integration Worker

Cloudflare-first runtime for the TLCE public site. The static GitHub Pages frontend never receives provider credentials.

## Routes

- `GET /health` — non-sensitive liveness.
- `GET /api/search?q=...` — Cloudflare Access authenticated search.
- `POST /api/ai/chat` — Cloudflare Access authenticated LLM proxy.
- `POST /api/files/presign` — authenticated short-lived direct-to-R2 upload grant.
- `POST /api/files/complete` — validates uploaded object metadata/size and enqueues quarantine processing.
- `POST /api/files/upload` — strict Worker-proxy upload with byte-signature checks before R2 storage.
- Queue consumer validates size, ownership metadata and magic bytes; it never marks a file malware-clean or releases it.
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
# Optional scheduled webhook (both are required to activate the cron dispatch):
npx wrangler secret put AUTOMATION_WEBHOOK_URL
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


## Direct-to-R2 presigned upload

Two upload modes are available:

- `POST /api/files/presign` creates a 5-minute, single-object S3-compatible R2 presigned PUT URL. The client uploads directly to the private R2 bucket using the exact signed headers returned by the API, then calls `POST /api/files/complete` with the returned `objectKey`.
- `POST /api/files/upload` is the strict Worker-proxy path. It checks Content-Length, actual received byte length, allowed MIME signatures (PNG/JPEG/PDF), and only then writes the object to R2 and enqueues inspection. Use this path when you require content validation before storage.

**Important size boundary:** the presign endpoint validates the size declared by the client before issuing a URL, but a normal presigned S3 PUT URL does not impose a hard byte-range policy. The completion endpoint checks the actual R2 object size and deletes oversized objects. For strict pre-storage size enforcement, use the Worker-proxy endpoint. In both paths, the object remains private and quarantined.

Presign request:
```http
POST /api/files/presign
Content-Type: application/json

{"contentType":"image/png","size":120000}
```

The response includes `uploadUrl`, `objectKey`, and the exact `requiredHeaders`. Browser upload:
```js
const grant = await fetch("/api/files/presign", {
  method: "POST",
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ contentType: file.type, size: file.size })
}).then(r => r.json());

const uploaded = await fetch(grant.uploadUrl, {
  method: "PUT",
  headers: grant.requiredHeaders,
  body: file
});
if (!uploaded.ok) throw new Error("R2 upload failed");

await fetch("/api/files/complete", {
  method: "POST",
  credentials: "include",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ objectKey: grant.objectKey })
});
```

Configure R2 CORS from `r2-cors.json` (allow only `https://tlce.store`; do not use wildcard origins). The R2 bucket must remain private with no public development URL or custom public domain.

## Queue processing and quarantine retention

Create the queue `tlce-file-inspection` before deploying the updated Worker. The `UPLOAD_JOBS` producer is bound in `wrangler.toml`; the consumer:
- checks the object exists, has the expected size and ownership/status metadata;
- reads the content and checks its magic bytes against the claimed MIME;
- deletes malformed, oversized, or inconsistent objects;
- acknowledges structurally valid files but **leaves them quarantined**. This queue consumer is not an antivirus engine and never promotes a file to production.

The six-hour Cron Trigger deletes objects under `quarantine/` older than seven days. This is a retention safety net, not a substitute for a malware scanner or a clean verdict.

## R2 credentials

Create an R2 S3 API token scoped to the single quarantine bucket with only the permissions required for presigned PUT. Store credentials as Worker secrets:
```sh
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put R2_BUCKET_NAME
```
Never commit R2 credentials. Prefer separate credentials for a future production bucket. The current code intentionally has no production-bucket binding and no release route.

# Runtime security notes

- Cloudflare Access JWT signature, issuer, audience, expiry and subject are verified before protected operations.
- Protected operations share a per-subject Durable Object rate limit of 20 requests/minute.
- CORS is restricted to `https://tlce.store`; credentials are never accepted from browser payloads.
- AI provider selection is controlled by server configuration. API keys are Worker secrets and are never returned to clients.
- AI prompts are capped at 8,000 characters; provider requests have a timeout where supported.
- Uploads require authentication, are limited to 5 MiB, and must match PNG/JPEG/PDF file signatures.
- R2 upload objects are private, stored under `quarantine/`, served as `application/octet-stream`, and have no public download route.
- Quarantine status is not a malware verdict. Signature validation and SHA-256 hashing do not detect malware.
- No upload release route exists. Do not expose or process quarantined files as trusted until an AV scanner and an independently authorized release gate are implemented.
- Automation webhooks are disabled unless explicitly configured; their bearer secret is stored only as a Worker secret.
- Provider errors are reduced to generic client-facing responses. Health output reveals no configuration or credential state.

- Presigned PUT URLs expire within five minutes and bind the object key, MIME type, owner hash and quarantine status.
- Presigned PUT cannot impose a strict byte-range policy; the completion handler checks actual R2 size and deletes oversize objects. Use the Worker-proxy upload route for strict size enforcement before storage.
- Queue validation checks magic bytes and object metadata only; it is not antivirus scanning. Valid files remain quarantined, and no production promotion exists.
- A six-hour Cron Trigger removes quarantine objects older than seven days.

- Server-to-server HMAC API keys are optional and accepted only when no Cloudflare Access assertion is present; keys are held in the Worker secret `TLCE_API_KEYS_JSON`, never in the frontend.
- HMAC signatures bind method, pathname, timestamp, nonce and exact request-body SHA-256; timestamps have a five-minute skew window and Durable Object nonce consumption prevents replay.
- Signed API requests share the same 20/minute principal rate limit. The in-memory Durable Object nonce ledger retains a bounded rolling set; keep the rate limit and nonce window assumptions aligned if either is changed.
- AI routing tries the configured primary and then unique `AI_FALLBACK_PROVIDERS` entries, with bounded per-provider attempts. Workers AI deadline racing does not cancel the underlying binding operation.
- Queue outcomes are written only to sanitized operational logs. Structural pass is explicitly not a clean/malware verdict; rejected objects are deleted, valid objects remain private in quarantine.

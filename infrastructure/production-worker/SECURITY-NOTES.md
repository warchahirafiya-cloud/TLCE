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

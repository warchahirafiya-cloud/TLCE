# TLCE Serverless Integration Architecture

## Deployment topology

```text
Browser (GitHub Pages: tlce.store)
          |
          | HTTPS + Cloudflare Access session
          v
Cloudflare Worker: tlce-integration-api
  |-- /api/search ------> existing search adapters
  |-- /api/ai/chat -----> Workers AI (default) OR configured Groq/Gemini API
  |-- /api/files/upload -> private R2 quarantine (no public reads)
  |-- Cron Trigger ------> optional authenticated automation webhook
  |
  +--> Durable Object: per-subject rate limiting

Private R2 bucket: tlce-private-uploads
```

## Service decisions

- **LLM:** Workers AI is the default low-ops option (model: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`). Groq uses the current `openai/gpt-oss-120b` model identifier. Groq and Gemini are optional server-side adapters. No Ollama, self-hosted Dify, or public provider keys in the browser.
- **Automation:** Cron Triggers and authenticated webhook routes cover simple schedules/events. Use Queues for asynchronous fan-out/retries when a real workload requires them. n8n is deferred until its visual workflow features justify separate hosting or a hosted plan.
- **Files:** R2 stores uploads privately in quarantine. A Worker can validate size, allowed file signatures, ownership metadata and hashes, but it cannot provide ClamAV-equivalent malware detection by itself. Do not release files without AV scanning.
- **Frontend:** no secrets, no privileged authorization logic, and no direct browser-to-provider calls.

## Cost controls

- Start on Cloudflare Workers Free and Workers AI free daily allocation.
- Keep prompt and upload limits bounded; retain rate limits.
- Do not provision paid plans or external scanning/LLM services without explicit approval.
- R2 storage/operations and provider quotas/pricing must be checked against current account terms.

## Deferred security gate

Before enabling user-facing file downloads or processing:
1. Select an AV scanner with acceptable privacy/retention terms.
2. Consume R2 object-create events through a Queue.
3. Scan the quarantined object in the selected scanner.
4. Persist an authenticated, auditable verdict bound to object key + SHA-256.
5. Release only a clean verdict through an authorized server-side transition.
6. Delete or retain malicious/failed scans under a documented retention policy.

Cloudflare WAF Malicious Uploads Detection is a managed option but is Enterprise + paid add-on, not a free Worker feature.

## Upload lifecycle detail

The authenticated API issues short-lived R2 presigned PUT grants bound to a random quarantine key, MIME type, owner hash and quarantine status. A completion call verifies actual object size and metadata before sending a Queue message. The consumer validates ownership metadata, size and magic bytes, deletes malformed objects, and leaves structurally valid objects quarantined. A six-hour Cron Trigger deletes quarantine objects older than seven days. No malware-clean verdict or production promotion is implemented; this remains blocked on an approved antivirus scanner and a separately reviewed release workflow.

For strict validation before any object is written to R2, use the Worker-proxy upload route, which validates actual request bytes and magic numbers before storage. Presigned direct PUT is an efficiency path and enforces declared size at grant time plus actual size at completion, not at the R2 ingress boundary.


## API gateway hardening and AI resilience (draft implementation)

- Cloudflare Access JWT remains the browser identity mechanism. A separate optional HMAC credential path is available only for trusted server-to-server calls to `POST /api/files/presign` and `POST /api/files/complete`; it is intentionally unavailable to public Pages JavaScript and other API routes.
- HMAC requests bind method, pathname + query, timestamp, nonce and exact body digest. Five-minute clock skew, atomic Durable Object nonce consumption and the existing 20 requests/minute per-principal limit reduce replay and abuse risk.
- AI routing tries the configured primary provider followed by the unique ordered fallback list. The default order is Workers AI, Groq, then Gemini. Each attempt has a seven-second deadline; external fetches are abortable, while a Workers AI binding race cannot cancel the underlying invocation.
- Queue validation enforces object ownership/status/size and claimed MIME-to-magic-byte agreement. Rejected objects are deleted and sanitized operational events are emitted. Structurally valid objects remain private in `quarantine/`; no production promotion or malware-clean verdict is implemented.
- This is source-only work on the draft development branch. Secrets, Durable Object/R2/Queue resources, Cloudflare settings and production deployments remain unconfigured and unchanged.

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

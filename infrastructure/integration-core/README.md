# TLCE Integration Core

A provider-neutral registry for search, LLM and API gateway capabilities.

## Scope
- Describes configured/enabled state for each integration.
- Publishes capability metadata without returning credentials.
- Runs only explicitly injected health probes; no implicit network calls are made.
- Isolates probe failures and hides exception details.
- Treats the gateway as incomplete until trusted identity and shared rate limiting are supplied.

## Security and activation
Pass booleans derived from server-side environment configuration. Never pass raw keys, tokens, connection strings or secret-manager values into this registry. Diagnostics are operational metadata, not an authorization decision. Protected handlers must continue enforcing their own identity and rate-limit policy.

The registry does not provision infrastructure, activate paid services, deploy endpoints or contact providers. A not_checked health state means no live health check was run; it must not be interpreted as healthy.

Protect any diagnostics endpoint with operator authorization. Do not expose detailed diagnostics publicly.

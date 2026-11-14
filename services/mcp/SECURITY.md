# MCP Gateway Security Notes

## Trust boundaries

1. AI host/client -> TLS ingress -> MCP gateway.
2. MCP gateway -> OAuth introspection endpoint.
3. MCP tools -> approved TLCE Core capability adapters.
4. QuestPulse -> TLCE Runtime Engine -> MCP client adapter.

## Mandatory controls

- TLS for all non-local endpoints.
- RFC 7662 token introspection; validate active state, expiry, client identity, scope and exact resource audience.
- No token values, request bodies, prompts or tool arguments in logs.
- Host and Origin validation through the official Express adapter.
- Strict request-size and tool-input element limits.
- Deny-by-default endpoint and per-tool scopes.
- Read-only starter tool; no arbitrary URL fetch, shell, filesystem or database access.
- Generic client-facing errors; detailed internal errors must not include secrets.
- Production audit events must be durable, append-only, access-controlled and retention-governed.

## Deployment blockers

This scaffold is not production-ready until the actual TLCE OAuth issuer is configured, protected-resource metadata is published, the durable audit adapter is connected, ingress rate limiting and TLS are configured, and security/conformance/load tests pass. Do not expose it publicly before those gates pass.

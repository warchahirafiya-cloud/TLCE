# TLCE MCP Gateway

An isolated MCP server service for **The Last Cosmic Explosion**. QuestPulse is an internal TLCE module and must consume capabilities through TLCE contracts; it must not run a second MCP gateway or own identity.

## Baseline

- Protocol target: MCP `2026-07-28` (modern/stateless era only).
- Official TypeScript SDK v2 packages, isolated from the root TLCE TypeScript 5.7 toolchain.
- Node.js 22+, TypeScript 6+, Zod 4.
- HTTP endpoint: `POST /mcp`.
- OAuth 2.0 resource-server validation via RFC 7662 introspection.
- Default-deny authentication and scopes.
- Only one read-only health tool is registered. No filesystem, shell, database, network-fetch, write, or Q.P business tools are exposed.

## Local setup

1. Copy `.env.example` to `.env`.
2. Configure a trusted OAuth 2.0 introspection endpoint and a dedicated confidential client.
3. Set `MCP_PUBLIC_URL` to the exact resource audience issued in access tokens.
4. Keep `MCP_BIND_HOST=127.0.0.1` for local work.
5. Install and validate:

```bash
npm install
npm run typecheck
npm test
npm run dev
```

The endpoint rejects legacy protocol-era requests. Use the modern 2026-07-28 protocol revision.

## OAuth contract

The configured introspection endpoint must return an RFC 7662 payload with:
- `active: true`
- a future numeric `exp`
- `client_id` or `sub`
- `scope` containing `mcp:connect`
- `aud` containing the exact `MCP_PUBLIC_URL` resource (origin and path)

The verifier uses HTTP Basic client authentication, disables redirects and caching, applies a timeout, bounds the response body, and never logs access tokens. Invalid tokens produce an OAuth `invalid_token` challenge; identity-provider outages remain server errors.

## Security boundary

- Bind to loopback by default. Public binding requires explicit host/origin allowlists and TLS termination at a trusted ingress.
- Do not trust forwarded identity headers. Only the OAuth introspection response establishes a principal.
- Do not add a tool until its schema, scopes, data ownership, audit event, timeout, output limits and threat model are reviewed.
- Mutating tools must require a separate scope and an explicit approval workflow outside model discretion.
- The current stdout audit sink is a development adapter only. Production activation requires the durable TLCE Core audit sink, retention controls and access controls.
- The official Express MCP host applies its JSON body-parser limit; pin and verify that limit during service deployment.
- No production deployment, secrets provisioning, OAuth provider configuration or public exposure is performed by this scaffold.

## Integration path

1. Replace the stdout audit sink with the TLCE Core durable audit adapter.
2. Integrate the actual TLCE identity provider's introspection contract and publish RFC 9728 protected-resource metadata.
3. Add gateway rate limits, quotas, request metrics and distributed tracing at the trusted ingress.
4. Register approved TLCE capabilities using least-privilege scopes.
5. Add a Q.P client adapter that calls this gateway through TLCE Runtime Engine contracts.
6. Run protocol conformance, auth-negative, DNS-rebinding, load and regression tests before any deployment.

## Version policy

The SDK major line is isolated here intentionally. Keep the SDK packages on the same compatible v2 release line and commit the generated lockfile before CI or deployment. Do not upgrade the root TLCE TypeScript compiler as part of this service.

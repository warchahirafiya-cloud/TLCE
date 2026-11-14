# TLCE Model Context Protocol Infrastructure

Status: isolated engineering scaffold; not production deployed.
Implementation branch: `feature/mcp-infrastructure-2026-11-14`
Target protocol revision: `2026-07-28`
Service: `services/mcp`

## Architecture boundary

The MCP Gateway is a TLCE infrastructure service. It is not a second application and is not owned by QuestPulse. Q.P will connect through a TLCE-approved client adapter and Runtime Engine contracts. Identity, authorization policy, audit retention and data ownership remain TLCE Core responsibilities.

## Implemented

- Separate Node.js 22+ service package using the official MCP TypeScript SDK v2, TypeScript 6+ and Zod 4. The root TLCE TypeScript toolchain is not upgraded.
- Stateless modern MCP HTTP handler targeting revision `2026-07-28`; legacy protocol traffic is rejected.
- Express adapter with Host/Origin validation from the official MCP SDK.
- RFC 7662 OAuth token-introspection verifier with expiry, exact resource audience, principal and scope checks.
- Fail-closed bearer authentication requiring `mcp:connect`.
- Per-tool scope enforcement for `tlce.health.read`.
- One read-only health tool. No arbitrary filesystem, shell, network fetch, database, write, or Q.P domain tools.
- Request-body parsing limits inherited from the official Express MCP host; verify the effective parser limit before production.
- Metadata-only audit event contract with an explicit `durable` capability flag; stdout is marked non-durable and is rejected at production startup.
- Environment-based configuration; no secrets are committed.
- Isolated CI for dependency audit, strict typecheck, unit tests and build.

## Security model

1. Only the configured OAuth introspection endpoint establishes caller identity.
2. Tokens must be active, unexpired, and audience-bound to the exact MCP resource URL.
3. Authentication and scope checks fail closed.
4. No credentials or bearer tokens are written to logs.
5. Loopback binding is the default. Public binding requires explicit host/origin allowlists and TLS at trusted ingress.
6. No mutating tool is enabled in this scaffold.
7. The SDK host rejects legacy protocol-era requests; clients must support the modern stateless revision.

## Validation

Latest scaffold CI verification before the audit hardening changes: `7e6145a3e06a284672faf1f05cca82aa5f9359fc`. Audit hardening changes are on the feature branch and require a fresh CI run.

- MCP CI: passed — dependency install, `npm audit` (0 reported vulnerabilities), strict TypeScript check, 6 unit tests, production TypeScript build.
- TLCE root CI: passed at the same commit.
- These checks validate the scaffold only; they do not certify the service for production.

## Production blockers

- Connect the actual TLCE Core identity provider and confirm its RFC 7662 introspection response contract.
- Publish RFC 9728 protected-resource metadata and bind it to the approved authorization-server issuer metadata.
- Implement and inject the actual TLCE Core durable, append-only, access-controlled audit adapter and retention policy. The production startup guard now refuses to run with the stdout development sink.
- Add ingress rate limiting, quotas, TLS configuration, request-size enforcement, metrics, tracing, alerting and operational dashboards.
- Generate and commit the npm lockfile; use reproducible `npm ci` installs and dependency provenance controls.
- Add MCP protocol conformance tests, negative authorization tests, host/origin tests, load tests and failure-mode tests.
- Review each proposed TLCE capability before registering it, including scope, schema, data classification, timeouts, output limits, idempotency and approval requirements.

No production secrets, cloud resources, public endpoint, DNS records or deployment have been created. Do not merge this branch to `main` or expose the service publicly until the production blockers are closed and reviewed.

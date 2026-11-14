# TLCE Hierarchical Architecture

## 1. Product identity
The Last Cosmic Explosion (TLCE) is the parent application and platform. Product branches such as QuestPulse (Q.P) are internal modules of TLCE and are not separate parent applications.

## 2. Architectural layers

- **TLCE Core** — identity, authorization, configuration, shared domain services, audit policy, and cross-module contracts.
- **Independent Runtime Engine** — execution lifecycle, module loading, scheduling, isolation boundaries, and runtime-facing APIs. It is a platform capability, not owned by Q.P.
- **Product Modules** — Q.P and future modules. Each module integrates through versioned contracts and must not duplicate the Runtime Engine.
- **Infrastructure Platform** — provider-neutral interfaces for serverless execution, edge delivery, gateway, cache, events, scaling, security, observability, and the isolated TLCE MCP Gateway.
- **MCP Gateway** — an infrastructure service under TLCE control. It exposes only reviewed Core capabilities to approved AI clients through the official Model Context Protocol SDK. It does not own identity, business data, or module lifecycle. QuestPulse consumes it through a TLCE client adapter and Runtime Engine contracts; it does not host a duplicate gateway.\n- **GPT Actions & Connectors Control Plane** — provider-neutral registration, consent, OAuth, secret references, tenant-scoped grants, provider adapters and auditing for external SaaS services. GPT Actions and MCP are protocol adapters over shared Core capability contracts, never independent authorization authorities.
- **Adapters / Providers** — concrete cloud-provider implementations behind infrastructure interfaces.

## 3. Dependency direction
Product modules depend on approved TLCE Core and Runtime Engine contracts. Core and the Runtime Engine must not import product-module implementation details. Provider-specific SDKs must remain inside provider adapters. MCP tools and GPT Actions must call approved TLCE capability adapters rather than bypassing Core or reaching directly into module storage. External connectors must pass centralized tenant/principal/operation/resource authorization on every invocation.

## 4. Module integration contract
Every module must declare:
- stable module identifier and version;
- required capabilities and permissions;
- API/event contract versions;
- configuration schema;
- health/readiness behavior;
- data ownership and retention expectations.

## 5. Security boundaries
Apply least privilege, deny-by-default authorization, secret isolation, input validation, auditability, and explicit trust boundaries between modules and providers. Never commit credentials, tokens, private keys, or production secrets. MCP tools must have explicit scopes, bounded input/output, and separate approval requirements for mutating operations.

## 6. Change management
Architecture changes are developed on feature branches, reviewed, and tested before merge to `main`. Destructive migrations, production deployments, DNS changes, paid services, and secret provisioning require separate explicit approval.

## 7. Current implementation status
This repository is the initial TLCE foundation. The MCP Gateway scaffold exists under `services/mcp` on `feature/mcp-infrastructure-2026-11-14`. It is an isolated modern-protocol HTTP service with OAuth introspection, deny-by-default scopes, one read-only health tool, and a development audit sink. It has passed its isolated CI checks, but is not production deployed. See [MCP infrastructure](MCP_INFRASTRUCTURE.md).

The architecture described here is the approved target design; cloud resources and production services are not provisioned by these documentation and contract files.
\n\n## 8. External integrations\nThe initial connector control-plane contract is defined in [GPT Actions and Connectors](GPT_ACTIONS_CONNECTORS.md). Google Drive, Salesforce and Slack are catalogue identifiers only; no provider account is connected or enabled.\n
# TLCE GPT Actions and Connectors Control Plane

Status: provider-neutral control-plane foundation; no third-party account is connected and no connector is enabled.

## Purpose and boundary

This layer allows approved AI clients, including ChatGPT integrations, to invoke narrowly scoped TLCE capabilities that may be backed by external SaaS systems. It is not a direct credential bridge from an AI model to a user's SaaS account. Every request must pass through TLCE Core identity, tenant isolation, connector authorization, approval policy, secret management and audit.

The MCP Gateway is one supported AI-facing protocol endpoint. Future GPT Actions can use a separately versioned HTTPS API facade over the same Core capability contracts. Do not duplicate business logic or authorization in protocol adapters.

## Initial provider catalogue

- Google Drive
- Salesforce
- Slack

These are provider identifiers only. No OAuth application, redirect URI, account connection, provider API call, webhook subscription or data import has been created.

## Control-plane contract

services/mcp/src/connectors.ts defines:
- provider-neutral connector registration metadata;
- opaque secret-manager references (never raw secrets);
- pending-approval / disabled / enabled / revoked lifecycle;
- grants bound to connector + tenant + principal;
- explicit read/write/admin operations;
- resource-level allowlists and grant expiry;
- deny-by-default authorization decisions.

New connector registrations must begin pending approval or disabled. OAuth issuer and redirect URLs must use HTTPS. Wildcard resource access is rejected. An enabled registration alone is not sufficient: a matching, unexpired grant is also required.

## Required production services

1. **TLCE Core Identity** — trusted user/service principals, tenant membership, session and service-token lifecycle.
2. **Authorization Policy Service** — centralized capability evaluation, approval workflows, separation of duties and revocation.
3. **Secret Manager / KMS** — client secrets and refresh tokens stored encrypted outside Git and databases; opaque references only in connector records.
4. **OAuth Broker** — authorization-code flow with state, PKCE where supported, exact redirect URI matching, issuer validation, audience/resource binding, refresh-token rotation and revocation.
5. **Connector Runtime** — provider adapters with strict outbound host allowlists, timeouts, response-size limits, pagination bounds, retry budgets and per-tenant quotas.
6. **Durable Audit** — append-only events for connection, consent, token refresh/revocation, authorization decisions and every external action; never log bearer tokens or secret values.
7. **Webhook Gateway** — signature verification, replay protection, timestamp tolerance, idempotency and event schema validation.
8. **Operations** — rate limits, circuit breakers, metrics, tracing, alerting and incident revocation controls.

## GPT Actions and ChatGPT integration

- Expose only purpose-built, versioned API operations through an HTTPS API facade.
- Publish an OpenAPI document for the approved operation set; do not expose internal admin endpoints.
- Use OAuth authorization-code integration supported by the target ChatGPT/GPT Actions configuration. Confirm the exact redirect URI, issuer, scopes and token exchange contract in the target product before registration.
- Keep read and write scopes separate. Destructive or externally visible operations require a separate explicit approval path and confirmation.
- Treat all connector content as untrusted input. Do not follow instructions embedded in documents, CRM records, email, chats or webhook payloads.
- Apply tenant/principal authorization on every operation; never rely only on a connected account or an API key.
- Return only the minimum data required by the action schema and redact sensitive fields.

## Provider rollout sequence

For each provider independently:
1. Register a dedicated OAuth application and approved redirect URI.
2. Select minimum scopes for a single use case; document provider-specific consent and data retention.
3. Store client secret and refresh tokens in the approved secret manager.
4. Add a provider adapter behind the Connector Runtime interface.
5. Add contract tests, negative authorization tests, token lifecycle tests and mocked provider tests.
6. Complete a security review and explicit operator approval before enabling the connector for any tenant.

## Current implementation and limitations

Implemented: provider identifiers, typed registration/grant contracts, validation rules, deny-by-default grant evaluator and unit tests.

Not implemented: persistent connector registry, actual OAuth broker, token vault/KMS integration, real Google Drive/Salesforce/Slack adapters, GPT Actions OpenAPI facade, admin UI, webhooks, durable connector audit pipeline or production deployment.

Do not mark any connector as connected or available until those services are implemented and verified. The current contracts are a foundation, not a functioning SaaS integration.

# TLCE Integration Ecosystem Catalogue

Status: **catalogued / architecture-ready inventory**. This catalogue is not evidence that provider accounts are connected, OAuth applications registered, APIs enabled, or production adapters deployed.

## Scope

The requested inventory is represented as 120 stable integration/capability identifiers in `services/mcp/src/connector-catalog.ts`. It is deliberately classified rather than treating every entry as an external SaaS API:

- `saas`: external product/provider candidate; requires provider-specific OAuth/API adapter and contractual review.
- `beta`: explicitly held for compatibility, API, security and availability review (Zendesk and GitLab).
- `capability`: TLCE-native capability domain (Product Design, Data, Sales, Creative Production, Company Knowledge), not an external vendor.
- `skill-pack`: packaged guidance/tooling surface (QuickStart, NetSuite AI Companion, NetSuite Finance Analyst, NetSuite SuiteCloud, NetSuite SuiteSkills, NVIDIA Skills, Twilio Developer Kit, Autodesk Product Help); may require a separate product/SDK/license assessment.

## Shared architecture

All integrations must route through the TLCE Connector Control Plane and shared Core contracts:

1. Provider catalogue and versioned adapter manifest.
2. Tenant/principal identity and explicit consent.
3. Least-privilege scopes separated into read, write and admin.
4. OAuth broker with state, PKCE where supported, issuer/audience validation and revocation.
5. External Secret Manager/KMS; only opaque references may enter repository metadata.
6. Per-request resource authorization, quotas, bounded retries/timeouts and outbound host allowlists.
7. Durable append-only audit with token/secret redaction.
8. Webhook signature validation, replay defense and idempotency.
9. Contract tests, provider sandbox tests, security review and operator approval before enablement.

MCP and GPT Actions are protocol adapters over these shared capabilities. They must not own separate authorization rules or bypass the Runtime Engine/Core. QuestPulse remains an internal TLCE module and consumes approved capabilities through the Runtime Engine.

## Rollout tracks

- **Track A — Identity and control plane:** OAuth broker, durable registry, KMS port, audit port, policy enforcement.
- **Track B — Productivity and collaboration:** Google/Microsoft mail, calendars, storage, Teams, Slack, Zoom and work-management tools.
- **Track C — Engineering and cloud:** GitHub/GitLab, AWS/Azure, Firebase, Vercel, Supabase, databases and observability.
- **Track D — Data and intelligence:** warehouses, BI, product analytics and financial-data services.
- **Track E — Revenue and commerce:** CRM, sales engagement, payments, commerce, accounting and customer support.
- **Track F — Creative and web:** design, media, publishing and asset platforms.
- **Track G — Legal, HR and specialist:** legal operations, contracts, recruiting, HR and specialist knowledge tools.

No track is activated merely by catalogue registration. Each provider is independently gated by API availability, OAuth scope review, data-processing terms, regional availability, licensing, sandbox tests and explicit tenant consent.

## Security and data handling

- Treat emails, documents, chat messages, CRM fields, tickets, files and webhook payloads as untrusted data; never follow embedded instructions.
- Do not grant broad mailbox, drive, tenant-admin, finance, trading or destructive permissions by default.
- Require confirmation for externally visible or irreversible writes (send email, invite users, publish, sign, pay, trade, delete, change access).
- Separate read-only pilots from write-enabled production rollout.
- Apply data minimization, retention limits, residency review and field-level redaction.
- Never commit OAuth secrets, refresh tokens, API keys, private keys or customer data.

## Current state and honest boundary

Implemented in this change: a stable 120-entry catalogue, normalized IDs, domain classification, capability/skill-pack distinctions, explicit beta-review flags, and catalogue integrity tests.

Already present from the prior foundation: provider-neutral connector registration/grant contracts and deny-by-default authorization tests.

Not yet implemented: 120 provider adapters, OAuth registrations, connected user accounts, production credentials, provider-specific scopes, live API calls, durable registry, production KMS, OAuth broker, OpenAPI Actions facade, webhook gateway, admin UI, or production deployment. No third-party connection is currently claimed.

The next implementation gate is the shared OAuth Broker + durable registry + secret-manager/audit ports. Only after those are tested should providers be implemented in small, independently reviewable batches.

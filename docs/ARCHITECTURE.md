# TLCE Hierarchical Architecture

## 1. Institutional and product identity

**TLCE** is the parent institutional identity and strategic umbrella. Its institutional descriptor is **The Global Institution of Excellence**. The founding name and historical origin is **The Last Cosmic Explosion**; this is retained as the historical name and is not replaced by the institutional descriptor.

TLCE's strategic domains include technology and artificial intelligence, education and knowledge, research and development, creativity and digital industries, and innovation and global collaboration. This strategic scope does not imply that every capability is already operational or that TLCE has legal incorporation, accreditation, or international recognition.

See [Global Institutional Identity & Strategic Charter](identity/GLOBAL-INSTITUTIONAL-IDENTITY-CHARTER.md) for the authoritative identity, mission, principles, governance, and communications standard.

QuestPulse (Q.P) is an internal product module of the TLCE parent platform, not a separate parent application.

## 2. Architectural layers

- **TLCE Core** — identity, authorization, configuration, shared domain services, audit policy, and cross-module contracts.
- **Independent Runtime Engine** — execution lifecycle, module loading, scheduling, isolation boundaries, and runtime-facing APIs. It is a platform capability, not owned by Q.P.
- **Product Modules** — Q.P and future modules. Each module integrates through versioned contracts and must not duplicate the Runtime Engine.
- **Infrastructure Platform** — provider-neutral interfaces for serverless execution, edge delivery, gateway, cache, events, scaling, security, and observability.
- **Adapters / Providers** — concrete cloud-provider implementations behind infrastructure interfaces.

## 3. Ecosystem and repository boundaries

- **TLCE.store** is a digital product/platform initiative aligned with the parent ecosystem; it does not define or exhaust the institutional scope.
- **TLCE AI LAB** is an independent AI research and engineering initiative. Its repositories and infrastructure remain separate from TLCE.store and TLCE-UI-LAB.
- **TLCE-UI-LAB** remains a dedicated UI research/prototyping workspace and does not own or replace TLCE Core contracts.
- **QuestPulse** remains an internal product module of the TLCE parent platform.

The institutional charter does not authorize repository consolidation, cross-project data sharing, deployment, or changes to established security boundaries.

## 4. Dependency direction

Product modules depend on approved TLCE Core and Runtime Engine contracts. Core and the Runtime Engine must not import product-module implementation details. Provider-specific SDKs must remain inside provider adapters.

## 5. Module integration contract

Every module must declare:
- stable module identifier and version;
- required capabilities and permissions;
- API/event contract versions;
- configuration schema;
- health/readiness behavior;
- data ownership and retention expectations.

## 6. Security boundaries

Apply least privilege, deny-by-default authorization, secret isolation, input validation, auditability, and explicit trust boundaries between modules and providers. Never commit credentials, tokens, private keys, or production secrets.

## 7. Change management

Architecture changes are developed on feature branches, reviewed, and tested before merge to `main`. Destructive migrations, production deployments, DNS changes, paid services, and secret provisioning require separate explicit approval.

## 8. Current implementation status

This repository is the initial TLCE foundation. The architecture described here is the approved target design; cloud resources and production services are not provisioned by these documentation and contract files.

## 9. Public and private interface boundary

The public website and private developer/operator console are separate experiences within the same TLCE platform. The GitHub Pages deployment of `apps/web` is public static content and must contain no secrets, private records, admin controls protected only by client-side logic, or privileged write endpoints. The developer console is a future private control-plane capability backed by TLCE Identity and server-side deny-by-default authorization, least-privilege roles, MFA, and audit logging. It must be deployed outside the public Pages artifact. See [Public and Developer Interface Boundary](PUBLIC_DEVELOPER_INTERFACE_BOUNDARY.md).

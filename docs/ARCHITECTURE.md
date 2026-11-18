# TLCE Hierarchical Architecture

## 1. Product identity
The Last Cosmic Explosion (TLCE) is the parent application and platform. Product branches such as QuestPulse (Q.P) are internal modules of TLCE and are not separate parent applications.

## 2. Architectural layers

- **TLCE Core** — identity, authorization, configuration, shared domain services, audit policy, and cross-module contracts.
- **Independent Runtime Engine** — execution lifecycle, module loading, scheduling, isolation boundaries, and runtime-facing APIs. It is a platform capability, not owned by Q.P.
- **Product Modules** — Q.P and future modules. Each module integrates through versioned contracts and must not duplicate the Runtime Engine.
- **Infrastructure Platform** — provider-neutral interfaces for serverless execution, edge delivery, gateway, cache, events, scaling, security, and observability.
- **Adapters / Providers** — concrete cloud-provider implementations behind infrastructure interfaces.

## 3. Dependency direction
Product modules depend on approved TLCE Core and Runtime Engine contracts. Core and the Runtime Engine must not import product-module implementation details. Provider-specific SDKs must remain inside provider adapters.

## 4. Module integration contract
Every module must declare:
- stable module identifier and version;
- required capabilities and permissions;
- API/event contract versions;
- configuration schema;
- health/readiness behavior;
- data ownership and retention expectations.

## 5. Security boundaries
Apply least privilege, deny-by-default authorization, secret isolation, input validation, auditability, and explicit trust boundaries between modules and providers. Never commit credentials, tokens, private keys, or production secrets.

## 6. Change management
Architecture changes are developed on feature branches, reviewed, and tested before merge to `main`. Destructive migrations, production deployments, DNS changes, paid services, and secret provisioning require separate explicit approval.

## 7. Current implementation status
This repository is the initial TLCE foundation. The architecture described here is the approved target design; cloud resources and production services are not provisioned by these documentation and contract files.

## 8. Public and private interface boundary

The public website and private developer/operator console are separate experiences within the same TLCE platform. The GitHub Pages deployment of `apps/web` is public static content and must contain no secrets, private records, admin controls protected only by client-side logic, or privileged write endpoints. The developer console is a future private control-plane capability backed by TLCE Identity and server-side deny-by-default authorization, least-privilege roles, MFA, and audit logging. It must be deployed outside the public Pages artifact. See [Public and Developer Interface Boundary](PUBLIC_DEVELOPER_INTERFACE_BOUNDARY.md).

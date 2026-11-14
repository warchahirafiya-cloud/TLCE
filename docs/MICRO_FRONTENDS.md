# TLCE Micro-Frontend Architecture

## Model

TLCE is the parent shell and platform authority. Product areas such as QuestPulse are independently built frontend bundles mounted by the TLCE host. A micro-frontend is not a separate product root or a fork of TLCE services.

- Each frontend owns its UI, routes below its assigned prefix, tests and release artifact.
- The TLCE shell owns navigation, identity, tenant context, authorization, design tokens, observability and global error handling.
- Frontends consume a narrow, versioned service facade. They do not connect directly to databases, message brokers, provider SDKs or other product modules.
- Cross-frontend communication uses versioned events or backend APIs, never private source imports.
- The host validates same-origin asset entrypoints, route uniqueness, dependencies and capabilities before invoking the injected loader.

## Runtime contracts

See `packages/contracts/src/micro-frontend.ts`. Each manifest declares an identifier, semantic version, API version, route, same-origin bundle entrypoint, capabilities and exact versioned dependencies.

`MicroFrontendRegistry` validates manifests, rejects route collisions and unsafe external entrypoints, and resolves dependency order. `MicroFrontendHost` checks route and manifest-declared capabilities before loading and mounting a bundle, and provides deterministic unmount lifecycle handling. It passes a scoped service facade: API calls require the exact declared capability, methods are allow-listed, paths reject traversal (including encoded traversal), and event publication/subscription requires explicit manifest grants and an allowed namespace. Concurrent duplicate mounts are rejected.

The loader is injected. This repository does not yet implement a production remote-bundle fetcher, signature verification or sandbox. Production loading must use immutable versioned assets, signed build provenance, CSP/SRI or equivalent integrity controls, a trusted same-origin asset host and review of third-party dependencies. Never execute arbitrary remote code.

## Component architecture

Shared visual components and tokens belong to the TLCE design system, while product-specific composition stays inside each frontend. Keep shared packages small and versioned to avoid coupling every release to every module. Use CSS scoping (CSS Modules or Shadow DOM) and explicit accessibility contracts to prevent style collisions.

## QuestPulse

QuestPulse remains an internal TLCE module. Its future UI bundle should mount under `/questpulse`, request only its own capabilities, and consume task/event services through the host facade. Its backend task worker and event pipeline remain server-side platform services, not browser code.

## Current status and production gates

The contracts, registry, host lifecycle and tests are implemented as a provider-neutral foundation. The static PWA shell has not yet been wired to a production frontend bundler or remote bundle loader. No independent bundle is deployed or activated.

Before production: select a build tool and artifact registry, implement signature/integrity verification, add CSP and sandbox strategy, establish shared design-system package versioning, configure route fallback and rollback, then run accessibility, performance, security and integration tests.

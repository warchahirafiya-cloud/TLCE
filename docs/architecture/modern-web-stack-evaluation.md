# TLCE modern web stack evaluation

Date: 2026-11-23  
Scope: evaluate Tailwind CSS v4, Rsbuild, TanStack Start and LangGraph.js against the repository as it exists after merge commit `b4087ab5e73f9be63eeadac02984ea011bafe36b`.

## Executive recommendation

Adopt these technologies selectively, not as one mandatory rewrite:

1. **Tailwind CSS v4:** suitable for a new component-driven UI or a gradual design-system pilot. It is not a runtime performance optimization by itself; it primarily improves styling authoring, token consistency and CSS build efficiency.
2. **Rsbuild:** a strong candidate when the frontend becomes a real TypeScript/React application with multiple entry points or substantial bundling needs. It is unnecessary overhead for the current static HTML/ES-module pages. Its 2.1 release documents both a Tailwind v4 plugin and TanStack Start integration.
3. **TanStack Start:** the best candidate of the three for a future authenticated TLCE operations console or moderation dashboard, where typed nested routes, validated URL state, loaders, SSR/streaming and server functions provide concrete value. Keep the public content site static/prerendered unless measured requirements justify SSR.
4. **LangGraph.js:** use only for multi-step, stateful, branching AI workflows that need checkpoints, resumability, retries and human approval. Do not put an agent runtime into every request path or automatically embed it in the existing lightweight Worker. Start with a separate orchestration boundary behind a Queue/API.

## Repository fit

The current public web surfaces are predominantly static HTML, CSS and native JavaScript modules. QuestPulse explicitly uses a static, read-only browser shell, has no login/write API, and is mounted into the parent runtime. The root package currently provides TypeScript/test tooling and Cloudflare Worker types, not a React application toolchain. The production Worker is a separate Cloudflare runtime with Access, R2 quarantine, Queues and Durable Objects.

That means a framework migration would affect build output, routing, deployment, CSP, Shadow DOM integration, SEO, asset paths and existing GitHub Pages workflows. It should be an independently measured app-level migration, not a root-level tool replacement.

## 1. Tailwind CSS v4 — styling layer

### Technical advantages
- CSS-first configuration: `@import "tailwindcss";`, `@theme` tokens and `@utility` custom utilities reduce the need for a JavaScript config file.
- Theme values are exposed as CSS custom properties, which can be reused by component CSS and runtime code.
- Automatic source detection reduces manual content globs; explicit `@source` declarations cover ignored or external component sources.
- The engine uses modern CSS features and a modern browser baseline. The official upgrade guide specifies Safari 16.4+, Chrome 111+ and Firefox 128+.
- The official v4 announcement reports up to 5x faster full builds and over 100x faster incremental builds in its own benchmark; these are framework benchmarks, not a guaranteed TLCE page-speed gain.

### Trade-offs
- Tailwind v4 requires modern CSS support; older browser requirements may force v3.4 or a separate compatibility strategy.
- Existing hand-authored CSS and Shadow DOM-scoped `styles.runtime.css` need a migration strategy. Global Tailwind preflight/reset must not unexpectedly leak into the host page or break the embedded QuestPulse shell.
- Dynamic class construction can evade source detection; use static class maps or explicit `@source inline()` where needed.
- CSS utility adoption may improve developer throughput but does not inherently reduce JavaScript execution or network latency.

### Recommended TLCE approach
Pilot v4 in a new isolated UI package or future admin console. Keep the current public static shell unchanged initially. Define shared design tokens in CSS custom properties, and decide explicitly how the tokens and generated styles are scoped for the parent document versus Shadow DOM. Compare generated CSS size and visual regression results before replacing existing styles.

## 2. Rsbuild — build system

### Technical advantages
- Rsbuild is powered by Rspack and uses Rust-based tooling in its build pipeline, with React/Vue/Svelte/Solid integrations.
- One bundler model for development and production can reduce differences between dev and production output.
- It supports webpack/Rspack plugin ecosystems and Module Federation use cases.
- Rsbuild 2.1 documents a first-party Tailwind v4 plugin and a TanStack Start plugin integration. Its announcement reports up to 30% Tailwind build improvement in the team's tests; treat this as a vendor benchmark, not a project guarantee.

### Trade-offs
- Introducing a bundler changes asset paths, source maps, chunking, CSP hashes/nonces, caching, deploy artifacts and CI.
- Existing Pages workflows currently deploy static directories. They would need an explicit build artifact contract and path verification.
- Rust-powered build speed does not guarantee smaller browser bundles or faster runtime interaction. Measure build time, HMR, JS/CSS output size, route TTFB and Core Web Vitals separately.
- The current small native-JS surface may build faster and be easier to maintain without a framework build pipeline.

### Recommended TLCE approach
Do not replace the root build pipeline. Create an isolated app package (for example, `apps/console`) and benchmark Rsbuild against Vite on the same representative route set. Use Rsbuild if its webpack compatibility, unified bundling or measured build performance wins; otherwise Vite remains a sound default. Rsbuild 2.1 is especially attractive if TanStack Start is selected because the integration is now documented.

## 3. TanStack Start — full-stack routing and rendering

### Advantages
- TanStack Router provides type-safe route definitions, nested layouts, search-parameter schemas, loaders, pending states and typed navigation.
- Start adds full-document SSR, streaming, server routes, server functions, middleware/context and client/server builds.
- Route-level rendering control supports full SSR, data-only SSR and client-only rendering.
- Static prerendering is available for content-oriented routes.
- It can deploy to different runtimes/providers, including Cloudflare, subject to adapter and runtime feature validation.

### Trade-offs and security requirements
- SSR and server functions introduce server runtime and deployment complexity absent from the current static Pages architecture.
- Type inference does not replace runtime input validation, authorization, CSRF protections or output encoding.
- Route loaders are isomorphic in important cases; code that needs secrets or privileged access must be placed behind explicit server-only boundaries such as server functions. Never assume a loader is server-only.
- Cloudflare compatibility must be tested for streaming, cache behavior, bindings, background tasks and any Node-specific dependency.
- SSR is not automatically faster: compare cold/warm TTFB, hydration cost, JS bytes, cacheability and Core Web Vitals on the target runtime.

### Recommended TLCE approach
Use TanStack Start for a new authenticated operations console if the product needs moderation queues, account-aware workflows, audit views or complex filterable routes. Keep the public brochure/catalogue surfaces statically served or prerendered. Keep existing Worker APIs as explicit service boundaries initially; do not duplicate security-sensitive logic in server functions. Use server functions for app-internal typed calls and server routes for external integrations/webhooks.

## 4. LangGraph.js — agentic backend orchestration

### What it adds
LangGraph is a low-level orchestration runtime built around shared state, nodes and edges. It can mix deterministic code with LLM decisions and provides streaming, durable execution, checkpoint persistence and human-in-the-loop interruption/resumption. Checkpointers persist graph state by thread and enable recovery, replay and inspection.

### Suitable TLCE workflow
A future controlled content/research pipeline could be modelled as:
1. ingest a candidate source/event;
2. normalize and validate the source URL and schema;
3. retrieve corroborating evidence;
4. run deterministic eligibility, policy and risk checks;
5. use an LLM for bounded extraction/classification with structured output;
6. run independent validation and contradiction checks;
7. pause for human review where policy requires it;
8. publish only after an authorized human decision;
9. record provenance, model/prompt versions, evidence references and audit events.

The LLM should never directly publish an offer, release a file, change permissions, spend money or execute an irreversible action. Use deterministic policy nodes and explicit approval interrupts before side effects.

### Runtime and operational trade-offs
- A graph/checkpointer adds dependency size, state storage, observability and schema-versioning obligations.
- External calls must be idempotent because interrupted or retried tasks may execute again. Store idempotency keys and make side-effect nodes safe to replay.
- Persist only the minimum required state; redact personal data and secrets before checkpointing. Define retention and deletion for threads/checkpoints.
- Cloudflare Workers are excellent for short edge request handling, but long-running stateful graph execution needs a compatible persistent checkpointer and carefully bounded work. Avoid blocking a request on a multi-step agent loop.
- Use a Queue-triggered orchestrator or a separate service/runtime with durable persistence. Compare Cloudflare Workflows for deterministic long-running orchestration; LangGraph is justified when dynamic graph control, LLM branching and human interrupts are core requirements.

### Recommendation
Do not add LangGraph to the production Worker yet. First define one concrete use case, its state schema, retention policy, human approval role, tool allowlist, budget/time limits and persistence backend. Prototype it as a separate service with mocked tools and no production side effects.

## Comparative summary

| Technology | Primary value | Runtime impact | Development impact | TLCE decision |
|---|---|---|---|---|
| Tailwind v4 | Design tokens and utility styling | Mostly CSS; runtime impact depends on emitted CSS | Faster consistent UI authoring | Pilot in isolated UI |
| Rsbuild | Fast integrated bundling | No inherent runtime win; output must be measured | Faster builds/HMR in suitable apps | Use for new React console if benchmark wins |
| TanStack Start | Typed full-stack routing, SSR and server functions | Can improve first render/streaming; adds server/hydration work | Strong route/data contracts | Candidate for authenticated console |
| LangGraph.js | Stateful agent orchestration | Adds orchestration and persistence latency | Simplifies complex branching/retry/HITL logic | Separate backend service only when justified |

## Proposed adoption sequence

1. Complete Cloudflare staging isolation and real-runtime tests for the existing Worker.
2. Select and integrate a trusted malware scanner; implement a fail-closed verdict contract and separately authorized release workflow.
3. Define an authenticated operations-console product boundary and benchmark Rsbuild/Vite with a small route prototype.
4. Pilot Tailwind v4 tokens and scoped styling in that console, not across all static pages.
5. Add TanStack Start only if the console needs SSR, typed nested routes and server functions.
6. Prototype LangGraph.js around one review/verification workflow, with durable checkpoints, human approval, idempotent tools and no autonomous publication.

## Official references

- Tailwind v4 announcement: https://tailwindcss.com/blog/tailwindcss-v4
- Tailwind upgrade guide: https://tailwindcss.com/docs/upgrade-guide
- Rsbuild introduction: https://www.rsbuild.dev/guide/start/
- Rsbuild 2.1 release (Tailwind and TanStack Start integration): https://rsbuild.rs/blog/v2-1
- TanStack Start overview: https://tanstack.com/start/latest/docs/framework/react/overview
- TanStack Start comparison: https://tanstack.com/start/latest/docs/framework/react/comparison
- LangGraph overview: https://langchain-ai.github.io/langgraph/
- LangGraph.js persistence concepts: https://github.com/langchain-ai/langgraphjs/blob/main/docs/docs/concepts/persistence.md
- LangGraph.js functional API and idempotency: https://github.com/langchain-ai/langgraphjs/blob/main/docs/docs/concepts/functional_api.md

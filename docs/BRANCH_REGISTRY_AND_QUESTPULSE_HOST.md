# QuestPulse Branch Registry and TLCE Host Integration

**Status:** Implemented on `feature/questpulse-host-registry-integration`; awaiting CI and review.  
**Parent:** THE LAST COSMIC EXPLOSION (TLCE)  
**Internal branch:** QuestPulse (`questpulse`)  
**Route namespace:** `/questpulse`

## 1. Parent/branch ownership

TLCE owns the application shell, module runtime, branch registry, route registry, identity, authorization, shared services, and lifecycle. Q.P owns only its domain-specific UI and future offer/publisher workflows.

The Q.P branch does not create:
- a second identity provider or session store;
- a second social graph, notification service, or shared media service;
- a second copy of the TLCE runtime;
- direct database access to another branch.

## 2. Implemented source map

| Source | Responsibility |
|---|---|
| `packages/contracts/src/micro-frontend.ts` | Shared mount, context, service facade, and loader contracts |
| `runtime/engine/src/micro-frontend-registry.ts` | Validates branch UI manifests, route namespaces, capabilities, and dependencies |
| `runtime/engine/src/micro-frontend-host.ts` | Capability-gated mount/unmount and scoped parent service facade |
| `runtime/engine/src/product-branch-registry.ts` | Coordinates module lifecycle and micro-frontend route registration as one product branch |
| `modules/register-built-in-branches.ts` | Single bootstrap point for built-in product branches |
| `modules/questpulse/src/manifest.ts` | Q.P module identity, version, API contract, dependencies, and requested permissions |
| `modules/questpulse/src/micro-frontend-manifest.ts` | Q.P route, UI version, same-origin packaging address, and requested capabilities |
| `modules/questpulse/src/index.ts` | Q.P module lifecycle implementation |
| `modules/questpulse/src/micro-frontend.ts` | Q.P UI mount adapter |
| `runtime/engine/src/questpulse-host.ts` | Composition root that registers, starts, mounts, unmounts, and stops Q.P |
| `runtime/engine/test/product-branch-registry.test.ts` | Branch registration, manifest consistency, duplicate and route-collision tests |
| `runtime/engine/test/questpulse-host.test.ts` | Q.P host mount, nested route, and teardown tests |

## 3. Registry behavior

The parent `ProductBranchRegistry` binds two existing parent registries:

1. `ModuleRegistry` — owns module identity, dependencies, requested permissions, and lifecycle implementation.
2. `MicroFrontendRegistry` — owns route namespace, UI manifest, dependencies, and requested capabilities.

A branch is accepted only when module and frontend manifests share the same `id`, `version`, and `apiVersion`. Both registries are preflighted before the live registries are changed. Duplicate IDs and route collisions are rejected.

Route resolution uses the most-specific registered route. The host now accepts nested routes under the owning branch (for example, `/questpulse/offers`) while rejecting paths that resolve to another branch or fail route validation.

## 4. Q.P host composition

The `createQuestPulseHost` composition root:

1. Creates the parent module and micro-frontend registries.
2. Registers the built-in Q.P branch through the single branch bootstrap.
3. Creates the TLCE `RuntimeEngine` and `MicroFrontendHost`.
4. Uses a static, explicit allowlist to resolve the Q.P UI adapter.
5. Starts the Q.P module before mounting its UI.
6. Stops the module if mounting fails.
7. Unmounts the UI and stops the module during teardown.

The host receives a parent-owned service facade and an authorization-derived capability set. Q.P currently requests **zero capabilities**. All service and event calls remain denied unless a future reviewed manifest explicitly requests capabilities and the parent authorizes them.

## 5. Loading and trust boundary

The current loader is intentionally **in-process and statically allowlisted**. It does not:
- fetch a remote URL;
- dynamically import user-controlled code;
- trust a branch-provided entrypoint as executable code;
- load an unverified remote bundle.

The manifest's same-origin `entrypoint` is a reserved packaging address for a future immutable artifact. It is not currently fetched and no such production asset is claimed to exist.

Dynamic or remote module loading remains disabled until signed artifacts, integrity verification, and a hardened process/container isolation boundary are implemented and reviewed.

## 6. Current Q.P UI boundary

The current Q.P adapter mounts an accessible, minimal branch surface into the TLCE-provided root. It proves the route, context, lifecycle, and teardown contract. It is **not** the full QuestPulse website.

The existing QuestPulse repository and legacy UI/business workflows have not been copied into TLCE by this change. The original `app.asar` remains a separate protected technical reference and is not modified.

The next source-integration task is a route, data, auth, media, and workflow mapping from the authoritative Q.P source into parent contracts. Q.P's existing local users/sessions must not become a second identity authority.

## 7. Tests added

- Module and frontend manifest identity/version/API consistency.
- Duplicate branch ID rejection.
- Route collision rejection.
- Nested branch route resolution.
- Q.P module lifecycle startup and shutdown through TLCE RuntimeEngine.
- Q.P UI mount and unmount.
- Host rejection of a route outside the Q.P namespace.
- Cleanup of the module lifecycle when mount fails.

These tests are included by the existing `tsx --test runtime/engine/test/*.test.ts` command. Their pass/fail status must be confirmed by CI on this branch before merge.

## 8. Remaining gates

- [ ] Confirm GitHub Actions typecheck and full test suite on this branch.
- [ ] Connect the real TLCE web shell/router to `createQuestPulseHost`; the current code is a host composition API, not a production browser bootstrap.
- [ ] Migrate the real Q.P UI into the branch adapter after source and asset review.
- [ ] Define and approve Q.P capabilities against actual parent APIs.
- [ ] Add end-to-end, accessibility, and security tests in the real shell.
- [ ] Review signed artifact and isolated execution architecture before any remote loading.
- [ ] Obtain explicit approval before merge, deployment, data migration, DNS, or paid infrastructure.

**Invariant:** one TLCE host, one identity, one runtime, one shared platform, and bounded internal product branches.

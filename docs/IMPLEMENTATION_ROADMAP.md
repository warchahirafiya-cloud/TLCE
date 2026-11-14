# TLCE Implementation Roadmap

## Foundation — implemented on feature/serverless-edge
- [x] Establish public parent repository and feature branch.
- [x] Define hierarchical architecture and serverless/edge target.
- [x] Add provider-neutral infrastructure contracts.
- [x] Add shared module manifest contracts.
- [x] Add deny-by-default authorization helper.
- [x] Add initial module registry and runtime lifecycle API.
- [x] Establish QuestPulse internal-module boundary documentation.
- [x] Validate manifest identifiers, versions, dependency declarations, and permission declarations.
- [x] Resolve dependency start order and reject missing dependencies and cycles.
- [x] Return defensive manifest snapshots from the registry.
- [x] Reject runtime permission grants outside the module's declared request.
- [x] Coalesce concurrent startup requests for the same module.
- [x] Add automated tests for registry integrity, permission enforcement, lifecycle behavior, and concurrent startup.

## Remaining engineering gates
1. Add module configuration schema validation and signed/verified module metadata.
2. Add audit events, structured telemetry, and trace propagation.
3. Add adapter contract tests and reference adapters for cache, event publishing, and serverless execution.
4. Design durable event delivery, idempotency storage, retry policy, and dead-letter handling.
5. Add a hardened module isolation model before loading untrusted module code.
6. Complete the QuestPulse integration mapping and migrate its domain behavior through TLCE Core contracts without duplicating identity or social services.
7. Perform a documented security review and threat model.
8. Add production-grade authentication, request validation, rate limiting, and gateway hardening.
9. Evaluate provider adapters in a non-production environment after explicit approval.

## Release policy
All work remains on a feature branch until tests, security review, and maintainer review pass. No production deployment, DNS mutation, paid cloud resource, or secret provisioning is implied by this roadmap. The main branch is not modified by this work.

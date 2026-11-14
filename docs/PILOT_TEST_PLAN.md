# TLCE Pilot Test Plan

Date: 2026-11-14
Target: controlled pilot readiness assessment
Working branch: `pilot/qa-hardening-2026-11-14`
Protected scope: `main` and the original `app.asar` are not modified.

## Purpose

Verify the TLCE hierarchical platform foundation and its internal QuestPulse integration boundary before any external pilot. QuestPulse remains an internal module of The Last Cosmic Explosion (TLCE), not a separate product.

## Test stages

1. Repository/build integrity: dependency installation, TypeScript strict typecheck, complete unit test suite.
2. Runtime: manifest validation, dependency ordering, lifecycle serialization, failure cleanup and permission boundaries.
3. Identity and API gateway: authorization defaults, request/path validation, traversal rejection, correlation IDs and safe error handling.
4. Event processing: idempotency, retry limits, backoff, dead-letter behavior and failure recovery contracts.
5. Outbound security: protocol/host validation plus documented DNS, redirect and egress-control limitations.
6. Audit: metadata validation, sensitive-key rejection, immutability and persistence gap.
7. LLM7 integration: method/content-type validation, origin checks, bounded request body, message schema, secret handling and provider failure isolation.
8. QuestPulse integration: source inventory, routes/schema/business-rule mapping, module contract and regression coverage.
9. Release review: unresolved critical/high risks, evidence links, CI status and explicit go/no-go decision.

## Execution rules

- Run all checks on the pilot branch; do not commit directly to `main`.
- Do not modify, unpack-and-repack, or replace the original `app.asar` without separate explicit approval.
- No production deployment, DNS change, paid service, or live provider credential is part of this test.
- Unit-test success is not production certification.
- Record every case as PASS, FAIL, BLOCKED, or NOT RUN with commit SHA and evidence.
- Any critical security failure blocks the pilot.

## Local/CI commands

```bash
npm install
npm run typecheck
npm test
```

## Acceptance gates

- Typecheck and all unit tests pass on the same branch HEAD.
- No unresolved critical security issue.
- LLM7 route is not publicly exposed until trusted authentication, per-user/IP rate limiting, quotas and provider spending limits are mounted at the edge.
- Durable event idempotency, broker/DLQ, sandboxing, persistent audit sink and DNS-aware outbound controls are deployment prerequisites, not assumed present.
- QuestPulse integration is demonstrated with tests, not inferred from documentation.
- Release owner approves the final evidence-based report.

# TLCE Pilot Test Report

Date: 2026-11-14
Branch: `pilot/qa-hardening-2026-11-14`
Base: `main`
Status: IN PROGRESS — NOT APPROVED FOR EXTERNAL PILOT

## Scope protection

- Changes are isolated to the pilot branch.
- `main` has not been modified.
- Original `app.asar` has not been modified.
- No deployment, DNS change, paid service, or production credential was used.

## Changes made

1. Hardened LLM7 request-body handling by reading the request stream with a strict 64 KiB byte ceiling. This enforces the limit even when Content-Length is absent or unreliable.
2. Reject malformed Content-Length values rather than allowing NaN to bypass the declared-size check.
3. Added unit tests for streamed oversized bodies and malformed Content-Length.
4. Enabled GitHub Actions push validation for `pilot/**` branches.
5. Added this test plan, case register and report.

## Verification status

| Check | Result |
|---|---|
| Branch created from reviewed main HEAD | PASS |
| Changes committed to pilot branch | PASS |
| Original app.asar untouched | PASS — no app.asar write performed |
| npm typecheck | NOT RUN — awaiting CI execution |
| npm test | NOT RUN — awaiting CI execution |
| Deployed route authentication | BLOCKED — deployment adapter not present |
| Rate limiting/provider quotas | BLOCKED — edge integration not present |
| QuestPulse source integration | BLOCKED — source inventory and contract mapping required |
| Production security review | NOT RUN |

## Known production blockers

The repository threat model identifies missing production adapters: trusted identity/authentication, rate limiting, durable event storage and DLQ, DNS-aware egress controls, module sandboxing, persistent audit sink, observability and deployment infrastructure. LLM7 handler documentation also requires the route to be mounted behind identity and rate-limit middleware.

## Decision

Do not expose the pilot publicly and do not claim production readiness. Wait for CI results on the final pilot branch HEAD, complete QuestPulse source integration, and close or formally accept all security blockers before a go/no-go decision.

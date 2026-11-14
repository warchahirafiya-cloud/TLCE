# TLCE Pilot Test Cases

Date: 2026-11-14
Working branch: `pilot/qa-hardening-2026-11-14`
Verified CI HEAD: `31d3cd0dc6f1f1a59d2caca01e6f1e725f656614`
CI run: [TLCE CI #109](https://github.com/warchahirafiya-cloud/TLCE/actions/runs/43581946145)
Status vocabulary: PASS / FAIL / BLOCKED / NOT RUN

| ID | Area | Test | Expected result | Status |
|---|---|---|---|---|
| BUILD-01 | Build | Install project dependencies | Install completes | PASS |
| BUILD-02 | TypeScript | Run `npm run typecheck` | No type errors | PASS |
| BUILD-03 | Unit suite | Run `npm test` | All tests pass on same HEAD | PASS — 52/52 |
| RT-01 | Runtime | Reject malformed module manifests | Invalid manifest is rejected | PASS |
| RT-02 | Runtime | Detect missing dependencies and cycles | Registration/start is blocked safely | PASS |
| RT-03 | Runtime | Concurrent start/stop requests | Lifecycle remains serialized | PASS |
| RT-04 | Runtime | Module start failure | State and cleanup remain consistent | PASS |
| IAM-01 | Identity | Request undeclared capability | Deny by default | PASS |
| API-01 | Gateway | Traversal and encoded separator inputs | Request rejected | PASS |
| API-02 | Gateway | Invalid request/correlation identifiers | Request rejected or safe ID generated | PASS |
| EVT-01 | Events | Duplicate event delivery | Idempotency contract prevents duplicate effects | PASS |
| EVT-02 | Events | Repeated consumer failure | Bounded retry then dead-letter contract | PASS |
| EVT-03 | Events | Crash during processing | Durable recovery behavior verified with production adapter | BLOCKED |
| NET-01 | Outbound | Local/private literal IP and non-HTTP protocol | URL guard rejects destination | PASS |
| NET-02 | Outbound | DNS rebinding and redirect to private address | Egress layer blocks destination | BLOCKED |
| AUD-01 | Audit | Sensitive metadata key | Record construction rejects it | PASS |
| AUD-02 | Audit | Persistent retention/access controls | Durable sink demonstrates controls | BLOCKED |
| LLM-01 | LLM7 | Non-POST request | 405 response | PASS |
| LLM-02 | LLM7 | Invalid content type/message history | Request rejected | PASS |
| LLM-03 | LLM7 | Cross-origin browser request | 403 response | PASS |
| LLM-04 | LLM7 | Declared body larger than 64 KiB | 413 response | PASS |
| LLM-05 | LLM7 | Body larger than 64 KiB without Content-Length | Streaming reader stops and returns 413 | PASS |
| LLM-06 | LLM7 | Invalid Content-Length value | Request rejected | PASS |
| LLM-07 | LLM7 | Provider error/invalid response | Safe 502 response; provider details not leaked | PASS |
| LLM-08 | LLM7 | Missing server-side API key | 503 response; no provider call | NOT RUN |
| LLM-09 | LLM7 | Anonymous request against deployed route | Trusted edge authentication rejects request | BLOCKED |
| QP-01 | QuestPulse | Inventory preserved product prototypes and reconcile scope | Source inventory with explicit provenance and unresolved conflicts | PASS — initial inventory only |
| QP-02 | QuestPulse | Register Q.P through TLCE Runtime Engine | Module lifecycle and health contract work | PASS |
| QP-03 | QuestPulse | Legacy user-flow regression | Existing behavior preserved after reviewed migration | BLOCKED |
| QP-04 | QuestPulse | Inspect manifest permissions | No unreviewed capabilities are requested | PASS |
| QP-05 | QuestPulse | Supply mismatched module identity | Initialization is rejected | PASS |
| QP-06 | QuestPulse | Attempt start before initialization | Start is rejected | PASS |
| OPS-01 | Operations | Per-user/IP rate limits and provider quotas | Edge controls verified | BLOCKED |
| OPS-02 | Operations | Production secrets and spending limits | Managed secret store and provider limits verified | BLOCKED |

## Evidence

CI run #109 completed successfully on the exact HEAD listed above. The job log reports 52 tests passed, zero failed, zero skipped. The source inventory PASS is limited to cataloguing preserved prototypes; it does not imply feature migration or product-scope approval. Cases marked BLOCKED require production adapters, reviewed legacy source, or explicit product decisions and are not covered by this CI result.

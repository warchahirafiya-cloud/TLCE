# TLCE Pilot Test Cases

Date: 2026-11-14
Status vocabulary: PASS / FAIL / BLOCKED / NOT RUN

| ID | Area | Test | Expected result | Status |
|---|---|---|---|---|
| BUILD-01 | Build | Install project dependencies | Install completes | NOT RUN |
| BUILD-02 | TypeScript | Run `npm run typecheck` | No type errors | NOT RUN |
| BUILD-03 | Unit suite | Run `npm test` | All tests pass on same HEAD | NOT RUN |
| RT-01 | Runtime | Reject malformed module manifests | Invalid manifest is rejected | NOT RUN |
| RT-02 | Runtime | Detect missing dependencies and cycles | Registration/start is blocked safely | NOT RUN |
| RT-03 | Runtime | Concurrent start/stop requests | Lifecycle remains serialized | NOT RUN |
| RT-04 | Runtime | Module start failure | State and cleanup remain consistent | NOT RUN |
| IAM-01 | Identity | Request undeclared capability | Deny by default | NOT RUN |
| API-01 | Gateway | Traversal and encoded separator inputs | Request rejected | NOT RUN |
| API-02 | Gateway | Invalid request/correlation identifiers | Request rejected or safe ID generated | NOT RUN |
| EVT-01 | Events | Duplicate event delivery | Idempotency contract prevents duplicate effects | NOT RUN |
| EVT-02 | Events | Repeated consumer failure | Bounded retry then dead-letter contract | NOT RUN |
| EVT-03 | Events | Crash during processing | Durable recovery behavior verified with production adapter | BLOCKED |
| NET-01 | Outbound | Local/private literal IP and non-HTTP protocol | URL guard rejects destination | NOT RUN |
| NET-02 | Outbound | DNS rebinding and redirect to private address | Egress layer blocks destination | BLOCKED |
| AUD-01 | Audit | Sensitive metadata key | Record construction rejects it | NOT RUN |
| AUD-02 | Audit | Persistent retention/access controls | Durable sink demonstrates controls | BLOCKED |
| LLM-01 | LLM7 | Non-POST request | 405 response | NOT RUN |
| LLM-02 | LLM7 | Invalid content type/message history | Request rejected | NOT RUN |
| LLM-03 | LLM7 | Cross-origin browser request | 403 response | NOT RUN |
| LLM-04 | LLM7 | Declared body larger than 64 KiB | 413 response | NOT RUN |
| LLM-05 | LLM7 | Body larger than 64 KiB without Content-Length | Streaming reader stops and returns 413 | NOT RUN |
| LLM-06 | LLM7 | Invalid Content-Length value | Request rejected | NOT RUN |
| LLM-07 | LLM7 | Provider error/invalid response | Safe 502 response; provider details not leaked | NOT RUN |
| LLM-08 | LLM7 | Missing server-side API key | 503 response; no provider call | NOT RUN |
| LLM-09 | LLM7 | Anonymous request against deployed route | Trusted edge authentication rejects request | BLOCKED |
| QP-01 | QuestPulse | Inventory legacy routes, schema and business rules | Traceable source map | BLOCKED |
| QP-02 | QuestPulse | Register Q.P through TLCE Runtime Engine | Module lifecycle and health contract work | NOT RUN |
| QP-03 | QuestPulse | Legacy user-flow regression | Existing behavior preserved after reviewed migration | BLOCKED |
| QP-04 | QuestPulse | Inspect manifest permissions | No unreviewed capabilities are requested | NOT RUN |
| QP-05 | QuestPulse | Supply mismatched module identity | Initialization is rejected | NOT RUN |
| QP-06 | QuestPulse | Attempt start before initialization | Start is rejected | NOT RUN |
| OPS-01 | Operations | Per-user/IP rate limits and provider quotas | Edge controls verified | BLOCKED |
| OPS-02 | Operations | Production secrets and spending limits | Managed secret store and provider limits verified | BLOCKED |

## Evidence required

For executed cases, attach the exact branch HEAD SHA, CI run URL, test output, and relevant logs. Do not mark a case PASS solely because a test file exists.

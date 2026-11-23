# QuestPulse Secure Upload — Security Design Specification

- **Project:** TLCE / QuestPulse
- **Repository path:** `docs/security/QUESTPULSE-SECURE-UPLOAD-SPEC.md`
- **Status:** Approved architectural baseline; not implemented in production and not operationally tested.
- **Scope:** Design only. This document does not authorize deployment, Cloudflare resource creation, production traffic, or changes to the current local-preview behavior.
- **Working branch:** `feat/questpulse-secure-upload-local-preview`

## 1. Purpose and security principles

This specification defines the intended secure-upload architecture for QuestPulse. The design follows least privilege, deny-by-default access, server-side validation, isolation of untrusted content, and explicit state transitions.

The current Preact/Vite island is a local preview only. Client-side checks improve usability; they are not security controls and do not establish that a file is safe.

### 1.1 Trust boundaries

1. **Browser / Preact island:** untrusted. File name, extension, declared MIME type, size, and client-computed hashes are attacker-controlled inputs.
2. **Cloudflare Worker API:** authenticated control plane. It validates identity, authorization, upload sessions, limits, and state transitions.
3. **Quarantine storage:** private storage for untrusted objects. No public bucket access or user download path is permitted.
4. **Scanner:** isolated processing component with read-only access to quarantine objects.
5. **Approval component:** narrowly scoped component authorized to promote only objects with a successful, recorded scan verdict.
6. **Approved storage:** separate private namespace or bucket for approved files, exposed only through separately authorized application paths.

Shadow DOM is a presentation/style boundary, not a security boundary.

## 2. High-level architecture

The intended flow is:

1. The authenticated client requests an upload session.
2. The Worker validates the user's identity, authorization, quotas, declared metadata, and requested size.
3. The Worker creates a short-lived session bound to the authenticated subject and a server-generated object key under quarantine.
4. The client uploads only to that constrained destination, or streams the file through the Worker if direct upload constraints cannot be enforced safely.
5. The client calls the completion endpoint.
6. The Worker verifies the session and the existence/metadata of the quarantined object, then records the transition and enqueues a scan job.
7. The scanner reads the quarantined object, performs file-type and malware checks, and records a verdict.
8. Only the approval component may promote a clean object to approved storage.
9. The client polls the status endpoint; it never infers approval from upload completion.

**Important:** the object must land in quarantine from its first persisted byte. The completion endpoint does not move an untrusted object into quarantine; it verifies an object that is already quarantined.

## 3. API contracts

All endpoints require authenticated access. The Worker must derive the user subject from a verified identity assertion; it must never accept a user ID supplied in the request body as the authority.

### 3.1 Create upload session

`POST /api/files/presign`

**Purpose:** authorize and create a short-lived, single-object upload session.

**Identity:** when Cloudflare Access protects the application/API, validate `Cf-Access-Jwt-Assertion` server-side. Validate the JWT signature against the configured issuer's keys, issuer, audience, expiry, not-before (when present), and any required identity claims. Reject missing, malformed, expired, wrong-issuer, or wrong-audience assertions. Do not merely check that the header exists.

**Request:**

```json
{
  "fileName": "document.pdf",
  "fileSize": 1048576,
  "declaredMimeType": "application/pdf"
}
```

The values are untrusted declarations. Apply strict schema validation, filename length limits, control-character/path-separator rejection, and the configured allowlist. Never use the supplied filename as an R2 object key.

**Success — `201 Created`:**

```json
{
  "uploadId": "uuid",
  "uploadUrl": "short-lived-upload-url",
  "expiresAt": "2026-11-23T20:00:00Z",
  "maxFileSize": 5242880,
  "status": "pending"
}
```

The actual URL mechanism (Worker-mediated upload or constrained R2 presigned URL) must be selected during implementation review. If a presigned URL is used, constrain it to one server-generated quarantine key, one method, a short expiry, and the required signed headers. Do not expose R2 credentials or allow the client to choose a bucket/key. Confirm that the chosen mechanism can enforce the required size and request constraints; otherwise use Worker-mediated streaming.

**Required server behavior:**

- Bind `uploadId`, object key, expected maximum size, expiry, and authenticated subject in server-controlled state.
- Generate an unpredictable object key under the quarantine namespace.
- Enforce a 5 MiB maximum on the server and at the storage/upload boundary where supported.
- Enforce allowed file categories as a preliminary policy only; actual type is established by scanning bytes.
- Enforce per-user open-session quotas and rate limits.
- Return no storage credentials and no public object URL.

**Error responses:** `400` invalid schema/metadata, `401` unauthenticated, `403` unauthorized, `413` declared size exceeds policy, `415` unsupported declared category, `429` rate/quota limit, `5xx` transient service failure. Do not reveal internal storage details.

### 3.2 Complete upload

`POST /api/files/complete`

**Purpose:** notify the API that the upload attempt has finished and request server-side verification and scan scheduling.

**Request:**

```json
{
  "uploadId": "uuid"
}
```

A client-supplied hash is not required and must never be treated as authoritative. A client hash may optionally be accepted as a comparison hint, but the server/scanner must independently compute SHA-256 over the stored object.

**Required server behavior:**

1. Authenticate the caller and verify that the upload session belongs to that subject.
2. Verify the session exists, is not expired, and is in a completable state.
3. Verify that the exact server-generated quarantine object exists.
4. Verify actual stored size and relevant storage metadata against the session policy.
5. Compute or arrange an independent server-side SHA-256 calculation.
6. Perform an idempotent state transition to `quarantined`.
7. Enqueue a scan job using an idempotency key derived from the upload/session identity.
8. Return the current state; do not imply the file is safe or downloadable.

**Success — `202 Accepted`** (preferred because scanning is asynchronous):

```json
{
  "uploadId": "uuid",
  "status": "quarantined",
  "message": "Upload received and queued for security scanning"
}
```

Repeated completion requests must return the current state without creating duplicate logical scan work. Queue delivery may be at-least-once, so the consumer must also be idempotent.

### 3.3 Get upload status

`GET /api/files/{uploadId}/status`

**Purpose:** allow the authenticated owner to poll the state of an upload.

**Success — `200 OK`:**

```json
{
  "uploadId": "uuid",
  "status": "scanning"
}
```

Authorize every read against the authenticated subject. A valid identifier is not authorization. Use `404` for unknown or non-owned IDs where that avoids disclosing object existence.

### 3.4 State model

Allowed externally visible states:

- `pending`: session created; upload not yet verified.
- `uploaded`: object is present in quarantine and awaiting completion verification or enqueueing.
- `quarantined`: object is isolated and scan work is queued.
- `scanning`: scanner has claimed the job.
- `approved`: all required checks passed and promotion completed.
- `rejected`: a security/policy check failed; object remains inaccessible.
- `expired`: session expired before successful completion.

Transient infrastructure failures must not be mislabeled as a malware rejection. They remain retryable in the queue/state machine until the retry policy is exhausted; after exhaustion, transition to an operational failure/manual-review state (for example `scan_failed`) rather than falsely asserting that the file is malicious. The final public status vocabulary must include this state if that operational path is implemented.

Only the server may change states. State transitions must be validated and persisted atomically or with compare-and-set semantics.

## 4. Authentication, authorization, and request integrity

- Use verified Cloudflare Access identity assertions when Access is the configured identity provider.
- Validate signature, issuer, audience, expiry, and required claims on every protected request, or use a rigorously designed short-lived verified-identity cache.
- Derive the subject from verified claims. Ignore client-supplied identity headers and body fields.
- Bind every upload session and object key to one subject.
- Enforce owner checks on completion and status requests.
- Apply least-privilege service bindings: upload path writes only to quarantine; scanner reads quarantine; approval component alone can promote to approved storage.
- Never grant browser clients R2 credentials or broad bucket permissions.
- Use TLS for all network transfers and avoid logging JWTs, presigned URLs, file contents, or sensitive metadata.

Cloudflare Access JWT validation authenticates the request but does not, by itself, prevent replay or CSRF in every deployment model. Use short-lived, single-purpose upload sessions, one-time completion semantics, strict origin/CORS policy, and CSRF protection if cookie-based browser authentication is used. Do not rely on a client-generated nonce alone as a replay defense.

## 5. Rate limits and resource quotas

Initial policy values (to be tuned using observed traffic and platform limits):

| Operation | Initial limit |
|---|---:|
| Create upload sessions | 5 requests per minute per authenticated subject |
| Complete upload | 10 requests per minute per authenticated subject |
| Status polling | 30 requests per minute per authenticated subject |
| Concurrent open sessions | 3 per subject |
| Maximum object size | 5 MiB per file |

Implementation requirements:

- Key limits primarily by verified subject; use IP/network signals as supplementary abuse controls, not as the user's identity.
- Return `429 Too Many Requests` with `Retry-After` where a retry time is known.
- Use a strongly coordinated counter/limiter (for example, Durable Objects) where strict per-subject concurrency and rate guarantees are required.
- KV is eventually consistent and should not be the sole enforcement mechanism for strict atomic counters or concurrent-session limits.
- Add global service-level protection for Worker, storage, scanner, and queue capacity.
- Ensure failed/expired sessions release concurrency slots safely and idempotently.

These are initial policy limits, not measured capacity guarantees.

## 6. Quarantine storage and retention

Quarantine must be private and inaccessible through public bucket access, public object URLs, or ordinary application download routes.

| Item/state | Initial retention | Action |
|---|---:|---|
| Session with no upload started | 30 minutes | Expire session and invalidate upload capability |
| Incomplete/unverified upload | Up to 24 hours | Delete object and expire session |
| Awaiting scan / retryable scan | Up to 24 hours, subject to active-job protection | Retry or escalate; do not delete while a valid scan is running |
| Rejected object | 24 hours for limited audit/review window | Keep inaccessible, then delete according to policy |
| Approved object | Governed by a separate product/data-retention policy | Promote only after all checks pass |

Retention jobs must coordinate with scan state and queue retries. Never delete an object while a valid scan attempt is actively processing it. Expired sessions must not be revivable by replaying an old URL or request.

“Secure deletion” in object storage should be described operationally as deletion through the provider's supported object lifecycle/API controls; do not claim forensic erasure guarantees that the storage provider does not document.

Approved storage needs its own access policy, retention schedule, and deletion workflow. The 24-hour quarantine policy does not define approved-file retention.

## 7. File validation and scanning

The server/scanner must not trust the browser's extension, MIME declaration, filename, or client hash.

Required checks, as applicable to each permitted format:

1. Enforce actual byte length (maximum 5 MiB).
2. Compute SHA-256 server-side over the exact stored bytes.
3. Detect file type from file signatures/magic bytes and validate structural consistency.
4. Compare detected type with the allowlist and reject mismatches.
5. Run an actual malware-scanning engine or a vetted scanning service with a defined update/failure policy.
6. Apply format-specific safety controls (for example, disallow active content or dangerous embedded features where the product does not require them).
7. Record scanner version, signature/update timestamp where available, verdict, object hash, and scan timestamp.

A file-signature check is not a malware scan. Workers AI is not assumed to be an antivirus engine and must not be represented as one. Any AI-assisted classification is supplementary and cannot replace deterministic file validation and a dedicated malware-scanning capability.

The allowlist for the current UI preview is PNG, JPEG, and PDF. The backend policy must independently define and enforce the supported formats.

## 8. Queue reliability and promotion

Cloudflare Queues may deliver messages at least once. Therefore:

- Consumers must be idempotent.
- Use a stable job/idempotency key tied to the upload ID and object version/hash.
- Persist scan claims and verdicts with concurrency-safe state transitions.
- Retry transient failures with bounded exponential backoff and jitter.
- Send poison/exhausted jobs to a dead-letter or operational-review path.
- Distinguish malware/policy rejection from scanner outage or infrastructure failure.
- Ensure a stale or duplicate message cannot overwrite a newer terminal state.

Promotion requirements:

- Only the approval component may write/promote into approved storage.
- Promotion is allowed only when the stored object hash matches the scanned object hash and the verdict is clean.
- R2 copy-and-delete operations must not be assumed to be an atomic filesystem-style move. Use a durable promotion state machine: copy to the approved key, verify the destination, commit the approved state, then delete the quarantine copy according to the recovery policy.
- If promotion partially fails, recovery must be idempotent and must never expose an unverified object.
- Approved objects remain private unless a separate authorization layer explicitly grants access.

## 9. Threat model

| Threat | Required mitigations |
|---|---|
| Malicious or disguised file | Magic-byte/structural validation, dedicated malware scan, quarantine isolation |
| MIME/extension spoofing | Treat declarations as hints; determine actual type from bytes |
| Oversized upload | Server-side and storage-boundary size enforcement |
| Cross-user object access | Subject-bound sessions and owner authorization on every endpoint |
| Presigned URL leakage/replay | Short expiry, single key/method, narrow scope, session invalidation |
| Completion replay | Idempotency key and atomic state transition |
| CSRF / cross-origin abuse | Strict CORS/origin policy and CSRF protection where cookie auth is used |
| DoS / resource exhaustion | Per-subject and global rate limits, concurrency quotas, size caps, queue capacity controls |
| Queue duplicate delivery | Idempotent consumer and persisted job state |
| Scanner outage | Bounded retries, operational failure state, no automatic approval |
| Promotion race/partial failure | Hash binding, compare-and-set state transitions, recoverable copy/verify/delete workflow |
| Sensitive data leakage | No public quarantine access; redact tokens, URLs, and file content from logs |

## 10. Observability and audit

Record security-relevant events with correlation IDs: session created, upload verified, completion accepted, scan started, scan verdict, promotion completed, rejection, expiry, and cleanup.

Audit records should include the upload ID, subject reference (minimized/pseudonymized where appropriate), object hash, detected file type, byte size, scanner/version metadata, timestamps, and outcome. Do not log file bytes, JWTs, presigned URLs, or unnecessary personal data. Define access controls and retention for audit logs separately.

## 11. Acceptance criteria and implementation gates

Implementation must not begin until the design review confirms:

- The upload transport can enforce the session's method, key, expiry, and size constraints.
- Cloudflare Access JWT validation and subject binding are specified and testable.
- Quarantine is private and the browser has no general R2 credentials.
- Scanner capability is a real malware-scanning solution, not merely AI classification or magic-byte inspection.
- Every state transition and queue consumer is idempotent and concurrency-safe.
- Promotion verifies the exact scanned object hash and handles partial copy/delete failures.
- Rate-limit and retention enforcement are implementable with the selected Cloudflare primitives.
- Threat-model mitigations and operational failure paths are covered by tests.

Before backend implementation, the existing frontend branch must pass the actual repository checks:

```bash
npm ci
npm run typecheck
npm run build:static
npm run test:static-ui
npm run test:questpulse
```

The commands above are required checks to run; this document does not claim they have passed. Confirm each script exists in `package.json` before relying on it.

## 12. Explicit non-goals and current phase boundary

At this stage:

- No Cloudflare Worker implementation is authorized.
- No R2 bucket, Queue, Durable Object, scanner, or production resource is to be created.
- No real upload or backend connection is enabled.
- No merge to `main`, pull request, or production deployment is authorized.
- The existing Secure Upload island remains a local-only simulation until a later, explicit implementation decision.

This document is an architectural baseline, not evidence of implementation, security certification, or operational test success.

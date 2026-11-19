# TLCE STORE Backend API Contract (Design Only)

**Status:** Provider-neutral contract draft. No API server is deployed.

## Trust boundaries

- Public catalogue reads are anonymous and read-only.
- Developer identity and submissions require authenticated sessions.
- Review decisions require an independent reviewer role.
- Publication requires a separate publisher role.
- Security suspension and takedown require a security administrator role.
- All authorization decisions are enforced server-side. Browser state and JSON catalogue fields are never trusted as proof of approval.

## API surface

| Method | Route | Access | Purpose |
|---|---|---|---|
| GET | `/v1/catalogue` | Public | Return published, non-suspended products only. |
| GET | `/v1/products/{productId}` | Public | Return the public profile for one published product. |
| POST | `/v1/developer-applications` | Authenticated applicant | Request external developer verification. |
| GET | `/v1/developer-applications/{applicationId}` | Applicant / reviewer | Read an application the actor is authorized to access. |
| POST | `/v1/submissions` | Approved developer | Create a draft product submission. |
| PATCH | `/v1/submissions/{submissionId}` | Submitting developer | Edit a draft or changes-requested revision. |
| POST | `/v1/submissions/{submissionId}/submit` | Submitting developer | Freeze a revision and enter intake. |
| POST | `/v1/submissions/{submissionId}/assign-reviewer` | Review lead | Assign a reviewer who is not the submitter. |
| POST | `/v1/submissions/{submissionId}/review-decision` | Assigned reviewer | Approve, reject, or request changes with evidence and reasons. |
| POST | `/v1/releases` | Publisher | Publish an exact approved revision. |
| POST | `/v1/products/{productId}/suspend` | Security administrator | Suspend public availability with an incident reference. |
| POST | `/v1/products/{productId}/withdraw` | Publisher / security administrator | Retire a product and preserve its audit history. |
| POST | `/v1/reports` | Public | Report a listing, download, or security concern. |

## Authorization rules

- Applicant accounts cannot assign reviewers, decide reviews, publish, or modify public catalogue state.
- A reviewer cannot approve a submission they created or submitted.
- A reviewer decision is bound to an immutable submission revision and evidence snapshot.
- A publisher may publish only a revision in `approved` state, and must not be its submitter or approving reviewer.
- Suspension immediately removes the product from public catalogue responses and disables download delivery.
- Administrative overrides require a reason and append-only audit event.

## Request and response rules

- Use JSON request/response bodies and UTF-8.
- Require HTTPS and an authenticated OIDC session for all non-public routes.
- Enforce CSRF protection for cookie-based sessions, strict CORS allowlists, request-size limits, rate limits, and schema validation.
- Reject unknown properties in security-sensitive request bodies.
- Use opaque identifiers; do not expose sequential internal database IDs.
- Return generic authorization failures without leaking whether a private submission exists.
- Public catalogue responses must be generated from server-side publication records, never from client-supplied status flags.
- Apply idempotency keys to submission creation, review decisions, publishing, and takedown actions.

## Suggested service boundaries

1. Identity and developer verification.
2. Submission metadata and revision service.
3. Review and audit service.
4. Artifact intake and quarantine service.
5. Security scanning and signing verification workers.
6. Publication and public catalogue service.
7. Abuse reports, takedown, and incident response.

## Artifact handling

- Uploads must enter private quarantine storage, never the public web root.
- Enforce allowlisted MIME types, file signatures, file-size limits, and archive expansion limits.
- Scan artifacts before reviewer access and again before release.
- Store SHA-256, signer fingerprint, scanner version, scan timestamp, and immutable object version.
- Android signing keys remain in a managed signing system or hardware-backed key custody, never in GitHub source, browser code, or the public Pages artifact.
- Public download URLs must be short-lived or served through a controlled delivery layer with revocation support.

## Error model

Use stable machine-readable codes such as:

- `VALIDATION_FAILED`
- `DEVELOPER_NOT_APPROVED`
- `INVALID_STATE_TRANSITION`
- `REVIEWER_NOT_INDEPENDENT`
- `REVISION_NOT_APPROVED`
- `ARTIFACT_SCAN_FAILED`
- `SIGNATURE_MISMATCH`
- `RATE_LIMITED`

## Deployment gate

Do not implement public submissions or APK delivery until an identity provider, database, private object storage, audit retention policy, malware scanning service, and incident-response owner have been selected and tested. The current GitHub Pages storefront remains read-only.

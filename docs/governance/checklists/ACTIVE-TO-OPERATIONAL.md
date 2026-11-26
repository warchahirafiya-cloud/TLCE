# Checklist: Active initiative → Operational

> **Decision rule:** Every mandatory (I) control must be completed and supported by evidence before status becomes Operational. Recommended (R) controls should be tracked; they do not independently block transition unless risk assessment makes them mandatory.

## A. Governance and accountability
- [ ] (I) Program owner formally appointed and dated.
- [ ] (I) Technical lead formally appointed.
- [ ] (I) Governance reviewer identified.
- [ ] (I) Current Program Charter approved and linked.
- [ ] (R) Succession/continuity arrangement documented.

## B. Technical source and release identity
- [ ] (I) Repository and relevant code paths identified.
- [ ] (I) Default branch and branch-protection/merge rules verified.
- [ ] (I) Deployment target and environment identified.
- [ ] (I) Release tag or immutable commit SHA identifies the candidate being assessed.
- [ ] (I) Evidence links resolve and correspond to that exact candidate.

## C. Quality and testing
- [ ] (I) Type checking passes on the release candidate.
- [ ] (I) Unit tests pass on the release candidate.
- [ ] (I) Production build/package validation passes.
- [ ] (I) Required integration or smoke tests pass, where applicable to the service.
- [ ] (R) Test coverage is measured and recorded.
- [ ] (R) Performance and load characteristics are measured where relevant.

## D. Security
- [ ] (I) Dependency/security findings reviewed; no unresolved critical/high findings without an approved, time-bounded exception.
- [ ] (I) Secrets are not committed; secret storage and rotation ownership are documented.
- [ ] (I) Least-privilege access is enforced and verified.
- [ ] (I) Security review and outstanding risks are recorded.
- [ ] (R) Recurring security scans are scheduled.

## E. Privacy and data governance
- [ ] (I) Data classification and data flows documented.
- [ ] (I) Processing purpose and applicable legal basis documented where personal data is processed.
- [ ] (I) Retention, deletion, and backup-expiry behavior documented.
- [ ] (I) Access controls for sensitive data verified.
- [ ] (R) DPIA or equivalent impact assessment completed where required.

## F. Operations and observability
- [ ] (I) Logging is enabled with secrets and sensitive data appropriately excluded.
- [ ] (I) Critical failure modes and alert ownership are documented.
- [ ] (I) Health/status checks are available where applicable.
- [ ] (I) Incident response and escalation procedure is documented.
- [ ] (R) Incident-response exercise completed.

## G. Continuity and recovery
- [ ] (I) Backup requirements assessed; scheduled backups verified where stateful data exists.
- [ ] (I) Recovery objectives and restoration procedure documented.
- [ ] (R) Restore test performed and evidence retained.

## H. Documentation and acceptance
- [ ] (I) Operator runbook published.
- [ ] (I) User/developer documentation published as applicable.
- [ ] (I) Baseline measures recorded, or non-applicability explicitly justified.
- [ ] (I) Evidence package linked from the Program Charter.
- [ ] (I) Owner and reviewer sign off on the exact release candidate.

---

## Transition decision

- **Mandatory controls completed:** __ / __
- **Decision:** ☐ Transition ☐ Defer ☐ Reject
- **Evidence/references:**
- **Outstanding exceptions and expiry dates:**
- **Rationale:**
- **Decision date:**
- **Owner:**
- **Independent reviewer:**

> A green CI run alone does not establish operational readiness. The decision must cover governance, security, privacy, operational controls, and the deployed release identity.

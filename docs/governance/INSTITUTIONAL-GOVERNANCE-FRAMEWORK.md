# TLCE — Institutional Governance Framework

**Status:** Proposed governance policy — approval required  
**Version:** 0.1  
**Date:** 2026-11-26  
**Applies to:** TLCE institutional identity, programs, laboratories, products, and shared initiatives  
**Parent reference:** [Global Institutional Identity Charter](../identity/GLOBAL-INSTITUTIONAL-IDENTITY-CHARTER.md)  
**Operating model:** [Organizational Structure & Program Governance](./ORGANIZATIONAL-STRUCTURE.md)

## 1. Purpose

This framework defines the minimum governance controls required to direct TLCE responsibly while its institutional model is being established. It is designed to be usable by a small founder-led initiative today and extensible to a formally constituted governing structure later.

This document is a proposal for internal governance. It does not create a legal entity, board, office, employment relationship, fiduciary appointment, accreditation, or authority to bind any person or organization.

## 2. Governance outcomes

TLCE governance must ensure that:

1. strategy and portfolio decisions have an identifiable accountable authority;
2. technical, security, privacy, legal, financial, and communications decisions are made by appropriately authorized owners;
3. evidence is retained for material decisions and maturity claims;
4. no initiative bypasses its documented repository, data, or infrastructure boundaries;
5. commitments, exceptions, and releases are explicitly approved before execution;
6. risks and conflicts are surfaced, recorded, reviewed, and resolved proportionately.

## 3. Governance principles

- **Accountability before hierarchy:** every material decision has one accountable decision owner, even when several people contribute.
- **Separation of duties where feasible:** proposal, review, approval, and execution should not collapse into one person for high-impact or irreversible actions. Where staffing makes separation impossible, record the limitation and add compensating review.
- **Least authority:** access and decision rights are limited to the scope and duration required.
- **Evidence-led decisions:** approvals reference the relevant tests, assessments, cost estimates, legal advice, or other supporting records.
- **Proportionality:** controls scale with impact, sensitivity, cost, reversibility, and external exposure.
- **Traceability:** decisions, exceptions, and approvals are recorded in version-controlled or otherwise auditable records.
- **No implied authority:** a title, program name, or diagram does not itself grant decision rights or signing authority.

## 4. Governance layers

### 4.1 Institutional direction

The institutional authority (currently the authorized founder/project owner, unless formally superseded) sets the mission, identity, strategic priorities, portfolio boundaries, and institutional risk appetite.

This authority does not waive applicable law, platform security controls, third-party terms, or technical release gates.

### 4.2 Program accountability

Each active program must have a named accountable owner before it accepts external commitments, processes sensitive data, incurs recurring costs, or enters operational service. Until an owner is explicitly assigned, the program remains under the current authorized project owner's oversight and must not imply independent delegated authority.

### 4.3 Specialist control functions

Architecture, security/privacy, quality, legal/compliance coordination, finance, and communications reviews may be performed by designated people or external specialists. A reviewer may advise or block progression within a documented control mandate, but does not automatically gain authority over unrelated program decisions.

### 4.4 Independent or external assurance

For material legal, regulatory, financial, safety, or security questions, obtain qualified independent advice where appropriate. Internal documentation and automated tests are not substitutes for professional advice, certification, or regulatory approval.

## 5. Decision classification and approval matrix

The following is the minimum proposed approval model. “Institutional authority” means the person or body currently authorized to make the decision; it is not a newly appointed office.

| Decision class | Proposal / preparation | Required review | Approval before action |
|---|---|---|---|
| Mission, institutional identity, strategic direction | Institutional authority | Relevant program owners; legal review for external/legal claims | Institutional authority |
| New program or material scope change | Program proposer | Portfolio, architecture, security/privacy, cost and legal review as applicable | Institutional authority |
| Architecture affecting multiple programs or trust boundaries | Technical owner | Architecture and security/privacy review | Authorized technical owner; institutional authority if portfolio/budget impact |
| Data collection, sensitive-data processing, or new data sharing | Data/program owner | Privacy, security, legal/compliance review | Explicitly authorized data/controller owner; no processing until resolved |
| Security exception or control deviation | Control owner | Independent security review where feasible; documented risk assessment | Institutional authority plus designated security authority; time-limited |
| Production release or external service activation | Release owner | CI, security, privacy, operations, rollback and cost evidence | Explicit release authority |
| Paid service, recurring spend, contract, or financial commitment | Requesting owner | Cost, funding, legal/contract review | Authorized financial/legal signatory; no authority is inferred |
| Public institutional, accreditation, certification, or partnership claim | Communications proposer | Evidence and legal/jurisdictional review | Institutional authority |
| Incident response and material disclosure | Incident lead | Security/privacy/legal as applicable | Incident authority under approved response plan; escalate material impact |
| Retirement, data deletion, or transfer | Program/data owner | Security, privacy, legal and operational review | Authorized program/data owner; institutional approval for material impact |

If the required reviewer or approver has not been designated, the decision is **pending**, not implicitly approved. Silence, CI success, a merged documentation change, or an informal conversation is not approval for production, spending, data processing, or external commitments.

## 6. Required decision records

Material decisions must be recorded in a durable decision log or an Architecture Decision Record (ADR), with at least:

- unique identifier, title, date, status, and affected program/repositories;
- decision owner and named reviewers;
- context, problem statement, options considered, and rationale;
- security, privacy, legal, operational, accessibility, and cost impacts as applicable;
- evidence links (tests, threat models, evaluations, quotations, advice);
- decision, conditions, scope, effective date, and expiry/review date;
- dissent, unresolved risks, and follow-up actions.

Recommended statuses: **proposed**, **under review**, **approved**, **rejected**, **superseded**, and **expired**. A proposal must not be presented as approved.

## 7. Change and release control

All changes must follow the controls applicable to the affected repository and service.

Minimum requirements for a material technical change:

1. work on a dedicated branch or approved isolated workspace;
2. state scope, exclusions, and affected trust boundaries;
3. update specifications and interface contracts where behavior changes;
4. pass required automated checks and review;
5. provide security/privacy and operational evidence proportionate to risk;
6. document migration, rollback, and recovery where applicable;
7. obtain explicit release approval before production deployment or external activation.

A green CI run proves only that the configured checks passed for the tested revision. It does not establish legal compliance, security certification, operational readiness, or approval to deploy.

## 8. Risk, exception, and conflict management

### 8.1 Risk register

Each active program should maintain a risk register with: risk ID, description, affected assets/users, likelihood, impact, owner, mitigation, residual risk, due date, and status.

### 8.2 Exceptions

Every exception must state the control being varied, business/technical rationale, affected scope, risk assessment, compensating controls, approving authority, owner, expiry date, and revocation trigger. Permanent or indefinite exceptions are not permitted by default. Critical controls protecting private data, credentials, or production systems must not be silently bypassed.

### 8.3 Conflicts of interest

Anyone proposing or approving a decision with a material personal, financial, or organizational interest should disclose it in the decision record and, where practical, abstain from independent review or approval. The remaining authorized decision owner must document how the conflict was handled.

## 9. Data, intellectual property, and confidentiality

Programs must define data ownership/control responsibilities, classification, permitted use, access, retention, deletion, backup expiry, and any cross-program transfer before processing non-public or personal data.

A shared institutional identity does not authorize data pooling, credential reuse, repository access, model training, or cross-program processing. Intellectual-property ownership, licenses, contributor rights, third-party assets, and publication permissions must be reviewed before external distribution or commercial use.

## 10. External statements and institutional status

External statements must distinguish:

- proposed programs from active initiatives;
- prototypes and pilots from operational services;
- internal evaluations from independent validation;
- strategic global ambition from actual international presence;
- learning resources from accredited qualifications;
- institutional branding from legal incorporation or trademark clearance.

Do not claim legal registration, accreditation, certification, government recognition, international offices, formal partnerships, or exclusive trademark rights without current documentary evidence and relevant jurisdictional review.

## 11. Review cadence and policy maintenance

- **Monthly while active:** review open decisions, material risks, exceptions, costs, and program status.
- **Quarterly:** review institutional priorities, governance effectiveness, and maturity claims.
- **Before material release or commitment:** perform the applicable approval checks.
- **At least annually after adoption:** review this framework and revise it through documented change control.

If there is no active team, the review may be a written self-review with an explicit note that independent review was unavailable.

## 12. Adoption and implementation

This framework becomes an internal policy only after explicit approval by the currently authorized institutional authority. Until then, its status remains **proposed**.

Recommended adoption sequence:

1. review this framework alongside the identity charter and organizational structure;
2. confirm the current institutional decision authority without implying legal appointment;
3. create a compact decision log and program portfolio register;
4. assign accountable owners only where authority and capacity are real;
5. define the release, security/privacy, cost, and public-claims approval paths;
6. review legal form, jurisdiction, contracts, and trademark questions independently before formal external commitments.

## 13. Non-authorization statement

Nothing in this framework authorizes merging pull requests, changing default branches, deploying production systems, changing DNS, provisioning credentials or paid services, sharing private data, signing contracts, or making legal or financial commitments. Those actions require their own explicit authorization and applicable technical, legal, and operational controls.

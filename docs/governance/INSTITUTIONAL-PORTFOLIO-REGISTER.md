# TLCE — Institutional Portfolio Register

**Register ID:** TLCE-PORTFOLIO-001  
**Status:** Initial baseline — proposed for governance approval  
**Version:** 0.1  
**Last reviewed:** 2026-11-26  
**Institutional parent:** TLCE — The Global Institution of Excellence  
**Governance:** [Institutional Governance Framework](./INSTITUTIONAL-GOVERNANCE-FRAMEWORK.md)  
**Organizational model:** [Organizational Structure](./ORGANIZATIONAL-STRUCTURE.md)  
**Quality model:** [Quality & Excellence Framework](../quality/QUALITY-AND-EXCELLENCE-FRAMEWORK.md)

## 1. Purpose and interpretation

This register is the controlled inventory of TLCE programs, laboratories, products, and proposed capabilities. It records their known status, accountability, evidence gaps, and next governance actions.

This is a planning baseline, not an independently audited inventory. Statuses reflect the project information available when this version was prepared. They must be revalidated against the relevant repositories, service evidence, and owner confirmation before external publication or a maturity claim.

The register does not create legal entities, appoint owners, authorize cross-project access, or imply that a prototype is an operational service.

## 2. Status vocabulary

| Status | Meaning | Minimum evidence |
|---|---|---|
| Proposed | Approved for consideration or planning only; not yet evidenced as active delivery | Concept, scope, rationale, and a decision record |
| Active initiative | Work is demonstrably underway, but the service is not asserted to be operational | Current repository/work artifacts or documented delivery activity |
| Paused | Work is intentionally suspended | Recorded pause decision, owner, and restart/retirement condition |
| Operational | A service is in actual use with accountable ownership and support controls | Named owner, users/use evidence, monitoring, incident path, service objectives, and approved costs |
| Retired | Work has been formally ended | Retirement decision, access closure, data/dependency disposition, and user transition where applicable |

**Important:** “Active initiative” does not mean production-ready, commercially registered, publicly launched, or operational. “Proposed” does not mean a team, office, course, lab, or service already exists.

## 3. Initial portfolio baseline

| Portfolio item | Type | Current status | Accountability | Boundary / evidence note |
|---|---|---|---|---|
| TLCE Institutional Identity & Governance | Institutional capability | Active initiative | Current authorized project owner; formal institutional role not appointed | Charter, organizational model, governance and quality documentation are being developed in this repository. Frameworks remain proposed pending explicit adoption. |
| TLCE AI LAB | Independent AI research/engineering initiative | Active initiative | Owner not formally recorded in this register | Separate repositories and infrastructure. Do not merge its technical or security governance with TLCE.store or TLCE-UI-LAB. Status requires verification in its own repositories before any maturity claim. |
| TLCE.store | Digital platform/product initiative | Active initiative | Owner not formally recorded in this register | Parent digital product/platform initiative. Domain and development context exist; this register does not assert commercial registration, production service readiness, or revenue operations. |
| TLCE-UI-LAB | UI research/prototyping workspace | Active initiative | Owner not formally recorded in this register | Dedicated UI-only workspace; separate from AI LAB and TLCE.store implementation repositories. Current branch and artifact status should be revalidated before release claims. |
| QuestPulse | Product module within TLCE.store | Active initiative — development scope | TLCE.store accountable owner not formally appointed | Internal module, not an independent institution or standalone parent platform. Implementation and production maturity are not asserted. |
| TLCE Research | Research and evaluation program | Proposed | Not assigned | No operational research office, staff, or independent review function is implied. |
| TLCE Academy | Learning and capability-building program | Proposed | Not assigned | No accredited course, qualification, or degree-awarding authority is implied. |
| TLCE Innovation | Applied innovation program | Proposed | Not assigned | No dedicated team, funding, or external partnership is implied. |
| Institutional Office | Institutional coordination function | Proposed | Current authorized project owner retains existing project-level authority | Conceptual governance function only; not a legally constituted office or appointed body. |
| Publications & Knowledge Assets | Knowledge/publishing capability | Proposed | Not assigned | Publication policy, rights clearance, editorial review, and content provenance remain to be defined. |
| Shared control functions (architecture, security/privacy, quality, legal coordination, finance, communications) | Cross-program capabilities | Proposed | No dedicated role assignments recorded | These are required functions in the operating model, not evidence of staffed departments or professional certifications. |

## 4. Ownership and decision accountability

No program owner is formally appointed by this register. Until explicit assignment is recorded:

- the currently authorized project owner retains existing project-level oversight;
- program-specific decisions remain subject to repository ownership, access controls, and approval gates;
- no program may infer authority to sign contracts, spend funds, process new categories of personal data, deploy production services, or make external institutional claims;
- an owner assignment must include scope, decision rights, capacity, conflicts, and effective date.

For active initiatives, the first governance action is to confirm a responsible owner and maintain a concise program charter. For proposed programs, appointment should follow a documented decision and capacity assessment.

## 5. Minimum portfolio record for each item

Every item should maintain the following fields as it matures:

| Field | Requirement |
|---|---|
| Portfolio ID | Stable unique identifier |
| Name and type | Program, lab, product, platform, or shared capability |
| Status and stage | Controlled status plus lifecycle maturity stage |
| Accountable owner | Named only after explicit assignment |
| Purpose and scope | Intended beneficiaries, boundaries, exclusions |
| Repositories/services | Authoritative locations and trust boundaries |
| Outcomes and KPIs | Defined formula, baseline, target, source, frequency |
| Quality evidence | Tests, evaluations, user evidence, limitations |
| Security/privacy | Data classification, threat model, retention, deletion, access |
| Legal/IP | Jurisdictional obligations, licenses, ownership, rights |
| Cost and funding | One-time and recurring full lifecycle cost; approval state |
| Dependencies and risks | Owners, mitigations, residual risk, due dates |
| Next gate | Required evidence and approving authority |
| Review date | Next scheduled review and review record |

## 6. Initial measurement plan

Do not fabricate baselines or targets. The first portfolio review should establish definitions and baseline data before numeric targets are approved.

| Dimension | Initial indicator definition | Baseline |
|---|---|---|
| Delivery health | Planned milestones completed on time / milestones due in period | Not yet measured |
| Quality | Verified acceptance checks passed / acceptance checks executed, with severity of failures separately reported | Per-revision CI evidence only; portfolio baseline pending |
| Reliability | Successful service requests / eligible requests over a defined period, if an operational service exists | Not applicable until service evidence exists |
| Security | Open critical/high findings by age and affected asset; time to containment for material incidents | Not yet consolidated |
| Privacy | Data assets with documented purpose, lawful basis/authority, retention and deletion controls / data assets in scope | Not yet inventoried |
| User value | Task success or outcome measure defined for the relevant user group | No validated portfolio baseline |
| Accessibility | Applicable critical user journeys passing the selected accessibility criteria | Not yet measured portfolio-wide |
| Cost efficiency | Full lifecycle cost per defined unit of outcome, including parsing, inference, storage, support and operations where applicable | Not yet measured |
| Research integrity | Material studies with documented method, provenance, limitations and review / studies in scope | Not applicable until research program is approved |

Metrics must be segmented by program and reporting period. Do not aggregate unlike activities into a single institutional score or use vanity measures as proxies for impact.

## 7. Review and change control

- **Monthly while active:** validate status, owner, risks, costs, evidence, and next gate.
- **Quarterly:** review portfolio fit, outcome measures, dependencies, and continue/pause/retire decisions.
- **Before external publication:** verify every status and maturity claim against current evidence.
- **On material change:** update the register through a reviewed pull request and record the decision.

Each update must preserve an audit trail and identify the source of changed status. A status may be promoted only when the relevant maturity evidence and approval are recorded.

## 8. Immediate next actions

1. Confirm the proposed institutional identity, governance, and quality frameworks through explicit review and adoption.
2. Verify each active initiative against its own repository and current artifacts; do not infer operational readiness from the portfolio label.
3. Record accountable owners and program charters only after explicit assignment.
4. Define a small number of outcome measures per active initiative and collect defensible baselines.
5. Inventory data, costs, dependencies, security risks, legal/IP constraints, and lifecycle/retirement obligations.
6. Reassess proposed programs only when there is a defined need, accountable capacity, and an approved decision.

## 9. Non-authorization

This register does not authorize merging pull requests, changing default branches, production deployment, DNS changes, credential sharing, new data processing, paid services, contracts, hiring, accreditation claims, or public announcements. Each requires separate explicit authorization and the applicable technical, legal, financial, and operational review.

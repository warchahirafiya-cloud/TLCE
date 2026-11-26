# TLCE — Quality & Excellence Framework

**Status:** Proposed institutional framework — approval required  
**Version:** 0.1  
**Date:** 2026-11-26  
**Applies to:** TLCE programs, laboratories, products, research, learning initiatives, and shared services  
**Governance:** [Institutional Governance Framework](../governance/INSTITUTIONAL-GOVERNANCE-FRAMEWORK.md)  
**Portfolio:** [Institutional Portfolio Register](../governance/INSTITUTIONAL-PORTFOLIO-REGISTER.md)

## 1. Purpose

This framework defines how TLCE should translate its commitment to excellence into observable, repeatable, and reviewable quality practices. It establishes a common quality system without pretending that all programs share the same technical, academic, research, or service metrics.

Excellence is demonstrated through sustained outcomes, integrity, safety, accessibility, reliability, and learning—not through slogans, self-awarded rankings, or unsupported claims of being “number one”.

This is a proposed framework. It does not constitute accreditation, certification, an external audit, or independent validation.

## 2. Quality policy

Every TLCE initiative must:

1. define the needs and outcomes it exists to serve;
2. set measurable acceptance criteria before claiming success;
3. identify its accountable owner, users, assets, and risk profile;
4. apply appropriate quality, security, privacy, accessibility, and legal controls;
5. preserve evidence sufficient to reproduce and review material claims;
6. measure actual outcomes and costs, not only activity or output volume;
7. disclose limitations, incidents, and unresolved risks honestly;
8. improve, pause, or retire work when evidence shows it is not meeting its purpose.

## 3. Quality dimensions

Use the dimensions below as a common institutional vocabulary. Each program selects the dimensions relevant to its mandate and defines its own measurable indicators.

| Dimension | Evaluation question | Example evidence |
|---|---|---|
| Relevance & usefulness | Does the work address a real, defined need? | User research, task success, adoption, outcome studies |
| Effectiveness | Does it achieve its stated outcomes? | Baseline-to-target measures, learning gains, validated results |
| Reliability & resilience | Does it behave consistently under expected and adverse conditions? | Availability, failure rates, recovery tests, incident records |
| Security & privacy | Are assets and people protected proportionately to risk? | Threat models, access reviews, security tests, data lifecycle evidence |
| Accessibility & inclusion | Can intended users access and use it effectively? | Accessibility audits, assistive-technology tests, user feedback |
| Research & knowledge integrity | Are methods, sources, limitations, and results transparent? | Protocols, provenance, reproducibility, peer/expert review |
| Operational sustainability | Can it be maintained responsibly? | Ownership, support, lifecycle costs, capacity and dependency reviews |
| Responsible impact | Are foreseeable social, environmental, and ethical effects assessed? | Impact assessments, mitigations, complaints and feedback |
| Interoperability & maintainability | Can the work evolve without unsafe coupling? | Documented contracts, architecture reviews, migration tests |
| Value & efficiency | Are resources proportionate to outcomes? | Full cost model, unit economics where relevant, benefits review |

## 4. Program-specific quality plans

Before a program enters a validated pilot, its owner should publish a concise quality plan containing:

- purpose, target users, scope, and exclusions;
- baseline, intended outcomes, indicators, and target values;
- measurement method, data source, sampling assumptions, and review period;
- acceptance thresholds and stop conditions;
- security, privacy, accessibility, and legal requirements;
- cost and operational assumptions;
- evidence owner, reporting location, and review date.

Targets must be justified by user needs, risk, technical constraints, or credible benchmarks. Do not invent external benchmarks or select metrics solely because they are easy to improve.

## 5. Measurement rules

### 5.1 Define indicators precisely

Each key performance or quality indicator must specify:

- name and purpose;
- numerator, denominator, unit, and calculation;
- population and exclusions;
- data source and collection frequency;
- baseline and target, including the rationale;
- accountable owner and reporting period;
- known bias, uncertainty, and limitations.

Prefer outcome and quality measures over vanity metrics. Report counts and percentages with denominators and time windows. Where sample sizes are small, label findings as preliminary and avoid overgeneralization.

### 5.2 Evidence hierarchy

When making claims, distinguish:

1. **Documented intention** — approved proposal or specification.
2. **Implemented artifact** — code, curriculum, prototype, or process exists.
3. **Automated verification** — configured tests pass on a named revision.
4. **Observed pilot evidence** — measured use or results in a bounded setting.
5. **Independent evaluation** — qualified reviewers assess methods and results.
6. **External recognition or accreditation** — formally granted by an identified competent body, with current scope and validity.

Evidence at one level does not automatically prove the next. A passing CI run is evidence about the checks executed on that revision; it is not proof of security certification, user value, regulatory compliance, or operational readiness.

### 5.3 Reproducibility and traceability

For material evaluations, retain the version tested, test/evaluation protocol, environment, dataset provenance and permitted-use basis, results, deviations, and reviewer. Protect personal, confidential, and licensed information; reproducibility must not override privacy or contractual restrictions.

## 6. Quality gates across the lifecycle

| Lifecycle stage | Minimum quality gate |
|---|---|
| Concept | Problem statement, intended users, rationale, exclusions, initial risk screen |
| Discovery | User/beneficiary evidence, feasibility, alternatives, baseline and success measures |
| Prototype | Bounded scope, isolated environment, test plan, safe/non-production data where possible |
| Validated pilot | Acceptance criteria met, user evidence, security/privacy/accessibility review, cost model, rollback and support plan |
| Operational service | Named owner, monitoring, incident response, service objectives, support capacity, approved recurring costs |
| Scale / partnership | Sustained outcome evidence, capacity, legal readiness, partner diligence, risk and impact review |
| Retirement | User transition, access revocation, data export/deletion and backup expiry, dependency and record closure |

A gate may be passed only when its required evidence is available and the authorized decision owner records the decision. Exceptions must follow the Institutional Governance Framework.

## 7. Domain-specific evaluation

Common dimensions should be adapted to each field:

- **Technology & AI:** functional correctness, robustness, latency, cost per task, privacy, security, model/system evaluation, human oversight, and failure containment.
- **Education & Knowledge:** learning outcomes, instructional validity, accessibility, learner support, assessment integrity, and content provenance.
- **Research & Development:** methodological rigor, reproducibility, data provenance, limitations, conflicts of interest, and appropriate review.
- **Creativity & Digital Industries:** user experience, originality and attribution, accessibility, production quality, rights clearance, and audience outcomes.
- **Innovation & Collaboration:** problem validation, feasibility, responsible experimentation, partner integrity, adoption evidence, and measurable impact.

No single cross-domain score should conceal critical failures. Report disaggregated dimensions and any non-compensable safety or integrity failures.

## 8. Quality assurance and review

A proportionate assurance cycle should include:

- **Continuous:** automated checks, defect tracking, security monitoring, and user feedback where applicable.
- **Before each material release:** review acceptance evidence, known defects, risks, rollback readiness, and authorization.
- **Monthly for active programs:** review indicators, incidents, costs, risks, and corrective actions.
- **Quarterly:** assess outcomes, target validity, maturity status, and whether the initiative should continue, change, or pause.
- **Periodically:** conduct peer, specialist, or independent review when impact, sensitivity, or external claims justify it.

A review must record its scope, evidence sampled, findings, limitations, action owners, due dates, and closure evidence.

## 9. Non-conformities and corrective action

Record material quality failures with:

- issue identifier, date, affected service/users, and severity;
- observed condition and expected requirement;
- immediate containment and user impact;
- root-cause analysis proportionate to severity;
- corrective and preventive actions, owners, and deadlines;
- verification that the action worked;
- residual risk and closure approval.

Do not close an issue solely because a ticket was updated or a patch was merged. Verify the correction against the original failure mode and relevant regression risks.

## 10. User feedback, complaints, and learning

Programs should provide a proportionate way for users or beneficiaries to report defects, accessibility barriers, safety concerns, and complaints. Define acknowledgement, triage, escalation, privacy, and resolution expectations before operational launch.

Feedback must be handled respectfully and without retaliation. Do not collect more personal information than needed. Use aggregated or de-identified feedback for quality improvement where practical and lawful.

## 11. Quality reporting and public claims

Internal reports should show:

- reporting period and program maturity stage;
- indicator values, denominators, baselines, and targets;
- trends and material changes;
- incidents, unresolved high risks, and corrective actions;
- evaluation limitations and confidence level;
- operating cost and resource constraints;
- decisions and next review date.

External claims must be traceable to current evidence and must state scope, date, method, and limitations where material. Do not claim “world-leading”, “number one”, “best in the world”, certified, accredited, or independently validated unless the exact claim is supported by credible, current, relevant evidence and any required permission.

## 12. Framework ownership and revision

The institutional authority approves this framework and any material policy change. Program owners maintain their quality plans and evidence. A designated quality owner may coordinate reporting and reviews when formally assigned; naming this function does not imply that such a person or team currently exists.

Review this framework at least annually after adoption, and earlier when major changes in law, risk, organizational scope, or operating model require it.

## 13. Adoption status and non-authorization

This framework remains **proposed** until explicitly approved. It does not establish external certification or accreditation, authorize new data processing, create legal obligations for third parties, approve spending, or authorize production deployment.

All implementation remains subject to program-specific controls, applicable law, and the Institutional Governance Framework.

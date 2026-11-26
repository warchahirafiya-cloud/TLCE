# Initiative Technical Source Audit

> **Audit rule:** Populate fields only from inspectable repository, CI, deployment, or documentation evidence. Record the evidence URL and check date. Unknown values remain “Unverified”; do not infer operational status from a repository name or a successful CI run.
>
> **Last updated:** YYYY-MM-DD  
> **Auditor:** Not assigned

## 1. Existing initiatives

| # | Initiative | Portfolio status | Repository/repositories | Default branch | Latest CI (run/result) | Build/package evidence | Deployment environment | Live service URL | Documentation path | Verification status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | TLCE AI LAB | Active initiative | Unverified in this audit | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Not audited | Separate initiative; do not conflate with parent TLCE repository or TLCE.store. |
| 2 | TLCE.store | Active initiative | Unverified in this audit | Unverified | Unverified | Unverified | GitHub Pages history recorded; current deployment evidence to verify | https://tlce.store/ (URL previously confirmed by project owner; current health not checked here) | Unverified | Partially evidenced; audit pending | Do not infer domain-registration or deployment status from the URL alone. |
| 3 | TLCE-UI-LAB | Active initiative | Unverified in this audit | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Not audited | Dedicated UI-only workspace; keep separate from TLCE AI LAB. |
| 4 | QuestPulse | Active initiative / internal TLCE module | Parent/module source mapping to verify | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Not audited | QuestPulse is an internal TLCE module, not an independent parent initiative. |

## 2. Proposed programs (not operational)

| # | Program | Portfolio status | Technical source | Operational service |
|---|---|---|---|---|
| 1 | TLCE Academy | Proposed | Not identified | None evidenced |
| 2 | TLCE Research | Proposed | Not identified | None evidenced |
| 3 | TLCE Innovation | Proposed | Not identified | None evidenced |

## 3. Evidence matrix

| Initiative | Repository evidence | CI evidence | Deployment evidence | Documentation evidence | Evidence count |
|---|---|---|---|---|---|
| TLCE AI LAB | ☐ | ☐ | ☐ | ☐ | 0/4 |
| TLCE.store | ☐ | ☐ | ☐ | ☐ | 0/4 |
| TLCE-UI-LAB | ☐ | ☐ | ☐ | ☐ | 0/4 |
| QuestPulse | ☐ | ☐ | ☐ | ☐ | 0/4 |

**Scoring:** 0/4 = no evidence verified; 1–2/4 = partial; 3/4 = substantial but incomplete; 4/4 = all four evidence categories verified. This score measures evidence coverage only; it is not an operational maturity rating.

## 4. Evidence capture procedure

For each initiative:

1. Verify the repository identity, visibility/access, default branch, and branch protection.
2. Record the latest relevant CI run URL, run number, commit SHA, and conclusion.
3. Verify the production build/package artifact for the same commit.
4. Verify the deployment environment and service URL; distinguish a configured URL from a healthy live service.
5. Verify documentation paths and README links.
6. Record evidence URLs, verification date, and auditor.
7. Record gaps and exceptions; do not upgrade portfolio status solely because evidence exists.

## 5. Audit record

| Date | Initiative | Evidence checked | Finding/gap | Auditor |
|---|---|---|---|---|
| YYYY-MM-DD | | | | |

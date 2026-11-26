# Initiative Technical Source Audit

> **Audit rule:** Populate fields only from inspectable repository, CI, deployment, or documentation evidence. Record the evidence URL and check date. Unknown values remain “Unverified”; do not infer operational status from a repository name or a successful CI run.
>
> **Permanent audit principle:** A passing CI on governance documents is not evidence of technical readiness. A passing CI on a service repository is not evidence of operational readiness. Readiness is asserted only through the mandatory gates in `ACTIVE-TO-OPERATIONAL.md`, supported by verifiable evidence.\n>\n> **Branch-CI ≠ Main-CI:** A successful run on a PR or feature branch is not evidence of `main` health. Record the branch and trigger for every run; do not substitute branch CI for a main-branch result.\n>\n> **Evidence precision:** Distinguish (a) no CI configured, (b) CI configured but not observed on `main`, (c) CI observed on `main` and failing, and (d) CI observed on `main` and passing. Conflating (a) and (b) is a documentation error.
>
> **Last updated:** 2026-11-26  
> **Auditor:** Not assigned

## 1. Existing initiatives

| # | Initiative | Portfolio status | Repository/repositories | Default branch | Latest CI (run/result) | Build/package evidence | Deployment environment | Live service URL | Documentation path | Verification status | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | TLCE AI LAB | Active initiative | `ai-lab-infrastructure`, `ai-lab-core`, `ai-lab-platform` | `main` confirmed on first two | See Evidence Log below; branch-scoped results differ | Unverified | Unverified | Unverified | Repository documentation not yet audited | Partial evidence; technical audit in progress | Separate initiative; do not conflate with parent TLCE repository or TLCE.store. No operational claim. |
| 2 | TLCE.store | Active initiative | Unverified in this audit | Unverified | Unverified | Unverified | GitHub Pages history recorded; current deployment evidence to verify | https://tlce.store/ (URL previously confirmed by project owner; current health not checked here) | Unverified | Partially evidenced; audit pending | Do not infer domain-registration or deployment status from the URL alone. |
| 3 | TLCE-UI-LAB | Active initiative | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Unverified | Not audited | Dedicated UI-only workspace; keep separate from TLCE AI LAB. |
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
| TLCE AI LAB | ☑ | ☑ | ☐ | ☐ | 2/4 — partial evidence coverage |
| TLCE.store | ☐ | ☐ | ☐ | ☐ | 0/4 |
| TLCE-UI-LAB | ☐ | ☐ | ☐ | ☐ | 0/4 |
| QuestPulse | ☐ | ☐ | ☐ | ☐ | 0/4 |

**Scoring:** 0/4 = no evidence verified; 1–2/4 = partial; 3/4 = substantial but incomplete; 4/4 = all four evidence categories verified. This score measures evidence coverage only; it is not an operational maturity rating. A failed CI run is evidence that a workflow executed and failed; it is not evidence of a passing quality gate.

## 4. Evidence Log — TLCE AI LAB (audit in progress)

> Evidence recorded from live GitHub inspection on 2026-11-26. No inference beyond what was observed. Private repository details are recorded from the authenticated GitHub connection.
>
> **Audit date:** 2026-11-26  
> **Auditor:** Not assigned

### 4.1 Repositories under audit

| Repository | Branch | Last commit | CI on main | Branch protection | Evidence state |
|---|---|---|---|---|---|
| `ai-lab-infrastructure` | `main` | `3ef1d88df48aa055cbac04e24f27027bf4b3af2e` | Run #7 — FAILED on this commit | Not protected (`protected=false`) | Partial; repository and CI evidence observed |
| `ai-lab-core` | `main` | `15bb181a1948f956fa687c06c696646b81baca47` | No runs recorded for `main` at audit time | Not protected (`protected=false`) | Minimal; repository evidence observed |
| Third AI LAB repository | Unresolved | Unverified | Unverified | Unverified | None; do not infer repository identity |

### 4.2 CI branch-scope clarification

- `ai-lab-infrastructure`: main-branch run [#7 — failed](https://github.com/warchahirafiya-cloud/ai-lab-infrastructure/actions/runs/45691786610), on commit `3ef1d88df48aa055cbac04e24f27027bf4b3af2e`. A later workflow run [#10 — success](https://github.com/warchahirafiya-cloud/ai-lab-infrastructure/actions/runs/45826878071) was observed on PR #5 branch `hardening/infrastructure-sbom-artifact`, not on `main`. Do not describe #10 as a green main-branch run.
- `ai-lab-core`: no Actions runs were recorded for `main` at audit time. A workflow run [#54 — failed](https://github.com/warchahirafiya-cloud/ai-lab-core/actions/runs/45829190567) was observed on PR #9 branch `hardening/core-replay-guard-contract-tests`; it is not a main-branch run.
- The third repository/branch identity remains unresolved. No source, CI, deployment, or protection evidence is attributed to it.

### 4.3 Evidence matrix by repository

| Repository | Repository evidence | CI evidence | Deployment evidence | Documentation evidence | Completion |
|---|---|---|---|---|---|
| `ai-lab-infrastructure` | ☑ exists; `main` and head commit verified | ☑ workflow observed; main #7 failed; PR #5 #10 passed | ☐ not verified | ☐ not audited | 2/4 — partial evidence |
| `ai-lab-core` | ☑ exists; `main` and head commit verified | ☐ no CI run on `main`; PR #9 #54 failed | ☐ not verified | ☐ not audited | 1/4 — minimal evidence |
| Third AI LAB repository | ☐ identity unresolved | ☐ unverified | ☐ unverified | ☐ unverified | 0/4 — unverified |

### 4.4 Governance gaps recorded (open blockers)

| Gap | Affected repositories | Severity | Status |
|---|---|---|---|
| `main` branch not protected | `ai-lab-infrastructure`, `ai-lab-core` | High | Open |
| CI failure on `main` | `ai-lab-infrastructure` | High | Open |
| No CI run recorded on `main` | `ai-lab-core` | High | Open |
| Third repository identity unresolved | Third AI LAB repository | Medium | Open |
| Deployment path/evidence not verified | All repositories under audit | Medium | Open |
| Documentation evidence not audited | All repositories under audit | Medium | Open |

### 4.5 Explicit non-claims

- TLCE AI LAB is **not** recorded as Operational.
- No repository is described as production-ready or operationally ready in this log.
- A successful PR-branch CI run is not represented as a successful `main` run.
- The presence of a service link, if any, is not treated as evidence of service health.
- CI success on governance documents (parent TLCE PR #60) is not evidence of technical readiness in TLCE AI LAB.

## 5. Evidence capture procedure

For each initiative:

1. Verify the repository identity, visibility/access, default branch, and branch protection.
2. Record the latest relevant CI run URL, run number, commit SHA, branch, and conclusion.
3. Distinguish CI runs on the default branch from runs on pull-request or feature branches.
4. Verify the production build/package artifact for the same commit.
5. Verify the deployment environment and service URL; distinguish a configured URL from a healthy live service.
6. Verify documentation paths and README links.
7. Record evidence URLs, verification date, and auditor.
8. Record gaps and exceptions; do not upgrade portfolio status solely because evidence exists.

## 6. Audit record

| Date | Initiative | Evidence checked | Finding/gap | Auditor |
|---|---|---|---|---|
| 2026-11-26 | TLCE AI LAB | Two repository main branches, branch protection flags, and Actions runs | Infrastructure main CI #7 failed and main is unprotected; core main has no CI run and is unprotected; platform repository identity resolved; platform main has no recorded CI and is unprotected; deployment evidence remains unverified; documentation requires review | Not assigned |


## 7. Evidence Log Addendum — repository identity and branch-CI distinctions

**Checked:** 2026-11-26

| Repository | Canonical identity | Default branch head | Main protection | CI on main | CI on other branches | Notes |
|---|---|---|---|---|---|---|
| `ai-lab-platform` | Confirmed: `warchahirafiya-cloud/ai-lab-platform` (private) | `bac1e1869ffe96b0706b76b2321a794b24c36edb` | Not protected | 0 runs observed; no `.github/workflows` directory on main | Run #45 SUCCESS on `hardening/platform-ci-sbom-statistical-benchmarks` | README title says `-ai-lab-platform`; canonical GitHub repository name has no leading hyphen. |

Evidence:
- Repository: https://github.com/warchahirafiya-cloud/ai-lab-platform
- Main-branch CI query: https://github.com/warchahirafiya-cloud/ai-lab-platform/actions
- Feature-branch run #45: https://github.com/warchahirafiya-cloud/ai-lab-platform/actions/runs/45826864885

**Classification correction:** The repository identity is resolved, but operational readiness remains unverified. A feature-branch success does not substitute for a main-branch check. The absence of a workflow directory on `main` is evidence that no workflow definition was present at the inspected path and time; do not generalize this into a claim about every possible external CI system.


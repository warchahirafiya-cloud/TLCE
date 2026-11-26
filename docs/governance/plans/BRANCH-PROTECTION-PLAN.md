# Branch Protection Plan — AI LAB Repositories

> **Status:** Plan only. No configuration has been applied.
> **Scope:** `ai-lab-infrastructure`, `ai-lab-core`, `ai-lab-platform`
> **Authorization required:** Yes — separate, explicit authorization per repository before any setting is changed.
> **Created:** 2026-11-26

## 1. Purpose

Establish merge gates on each `main` branch that are verifiable, reversible, and do not lock a repository before a proven merge path exists.

## 2. Explicit non-authorization

This document does not authorize enabling protection rules, modifying workflows, changing repository settings or branch names, or bypassing any existing rule. It is a planning artifact only.

## 3. Pre-flight checks

Complete separately for each repository before proposing settings.

| Check | Evidence method | Result |
|---|---|---|
| Current plan supports the required rules for private repositories | GitHub account/repository settings and current GitHub plan documentation | Unverified |
| Current `main` protection/ruleset state | GitHub branch/ruleset read-only inspection | Previously observed unprotected; re-verify |
| Current `main` head SHA | Git ref/commit inspection | Capture at review time |
| Actual check names and workflow context | Actions run/check-run details | Capture; do not guess |
| Reviewer availability | Explicitly confirmed repository reviewer | Unverified |
| Existing bypass actors/roles | Read-only ruleset/protection inspection | Unverified |

No required status-check name may be configured from an assumed job label. Record the exact check context emitted by GitHub. Before enforcing a check, verify that it is stable and that the repository has a viable PR merge path.

## 4. Proposed target configuration (not applied)

| Rule | Proposed policy | Rationale / condition |
|---|---|---|
| Require PR before merging | On | Prevent direct unreviewed changes |
| Required approvals | 1 when an independent reviewer is available | If unavailable, record a time-limited exception rather than silently blocking all merges |
| Dismiss stale approvals | On | A new change invalidates an old approval |
| Require status checks | Only exact, verified checks | Do not invent names; do not require a failing or nonexistent check |
| Require branches up to date | On where supported and operationally viable | Avoid merging against stale base |
| Require conversation resolution | On | Review threads must be addressed |
| Prevent force pushes | On | Preserve branch history |
| Prevent deletion | On | Preserve the default branch |
| Include administrators | Consider enabling after CI and recovery path are stable | Avoid premature lockout; document any temporary exception |
| Bypass list | Empty by default | Every exception needs actor, reason, scope, approver, and expiry |

Plan-tier feature availability must be verified before choosing classic branch protection versus repository rulesets. Do not assume that every control is available on the current plan.

## 5. Per-repository gap assessment

Populate these tables from a fresh read-only inspection. “Unverified” is not equivalent to “disabled”.

### 5.1 `ai-lab-infrastructure`

| Rule | Current state | Target | Gap / evidence | Blocking? |
|---|---|---|---|---|
| PR required | Unverified; protection previously absent | On | Capture current rule state | TBD |
| Required approvals | Unverified | 1 if reviewer available | Confirm reviewer availability | TBD |
| Required checks | Main CI #7 previously failed | Exact stable checks after CI repair | Do not enforce failing checks | Yes, until CI is repaired |
| Force-push prevention | Unverified; protection previously absent | On | Capture current rule state | TBD |
| Branch deletion prevention | Unverified; protection previously absent | On | Capture current rule state | TBD |

### 5.2 `ai-lab-core`

| Rule | Current state | Target | Gap / evidence | Blocking? |
|---|---|---|---|---|
| PR required | Unverified; protection previously absent | On | Capture current rule state | TBD |
| Required approvals | Unverified | 1 if reviewer available | Confirm reviewer availability | TBD |
| Required checks | No main run recorded at audit time | After a valid CI workflow is established and verified | Do not invent check names | Yes, until CI path exists |
| Force-push prevention | Unverified; protection previously absent | On | Capture current rule state | TBD |
| Branch deletion prevention | Unverified; protection previously absent | On | Capture current rule state | TBD |

### 5.3 `ai-lab-platform`

| Rule | Current state | Target | Gap / evidence | Blocking? |
|---|---|---|---|---|
| PR required | Unverified; protection previously absent | On | Capture current rule state | TBD |
| Required approvals | Unverified | 1 if reviewer available | Confirm reviewer availability | TBD |
| Required checks | No main CI run observed; no workflow directory found on main at prior inspection | Decide CI path first, then use exact verified checks | Re-verify main and workflow tree | Yes, until CI path exists |
| Force-push prevention | Unverified; protection previously absent | On | Capture current rule state | TBD |
| Branch deletion prevention | Unverified; protection previously absent | On | Capture current rule state | TBD |

## 6. Failure scenarios to resolve before activation

| Scenario | Impact | Mitigation | Status |
|---|---|---|---|
| Required check context is incorrect or absent | PRs cannot merge | Verify exact check context and test a PR before enforcement | Open |
| No independent reviewer is available | Approval requirement blocks merges | Time-limited documented exception; appoint reviewer before expiry | Open |
| Plan tier does not support a selected rule | Rule cannot be applied as designed | Verify feature availability; choose supported control or record limitation | Open |
| Protection is enabled while CI is failing or absent | No safe merge path | Stabilize CI first; verify a green PR path before enforcement | Open |
| Required checks are configured to require up-to-date branches but CI is unstable | Repeated blocked merges | Validate CI reliability and recovery procedure | Open |
| Emergency bypass is used without expiry | Permanent governance exception | Empty-by-default bypass list and auditable expiry | Open |

## 7. Bypass policy

The bypass list starts empty. Any exception must record the actor, reason, affected rule/repository, scope, approver, creation date, and expiry date. Expired exceptions must be removed through a separately authorized change and verified afterward.

## 8. Closure criteria — per repository

- [ ] Pre-flight evidence captured.
- [ ] Current-vs-target gap table completed.
- [ ] Plan-tier limitations verified.
- [ ] Reviewer and bypass policy resolved.
- [ ] CI checks are stable and exact names are evidenced.
- [ ] A controlled PR test demonstrates the intended behavior without risking production.
- [ ] Evidence is linked from the source audit.
- [ ] Separate explicit authorization to apply settings is recorded.

## 9. Proposed execution order — not authorization

1. `ai-lab-platform`: decide and establish a verified CI path first.
2. `ai-lab-core`: establish a verified CI path first.
3. `ai-lab-infrastructure`: diagnose and repair the failing main CI first.

Do not activate required checks on a repository until its checks and merge path are demonstrably viable. This ordering may be revised if fresh evidence changes the dependency sequence.

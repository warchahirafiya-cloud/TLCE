# Deployment Evidence Checklist — AI LAB Repositories

> **Purpose:** Distinguish deployment configuration, an executed deployment, endpoint response, and operational evidence.
> **Constraints:** Read-only inspection only. No deployments, secret-value access, load tests, or writes.
> **Scope:** `ai-lab-infrastructure`, `ai-lab-core`, `ai-lab-platform`.

## 1. Per-repository evidence register

Populate each cell from a trusted source. Use `Unavailable` or `Not verified` rather than guessing.

| Field | `ai-lab-infrastructure` | `ai-lab-core` | `ai-lab-platform` |
|---|---|---|---|
| Deployment workflow path | Not verified | Not verified | Not verified |
| Workflow branch/ref | Not verified | Not verified | Not verified |
| Trigger configuration | Not verified | Not verified | Not verified |
| Deployment platform | Not verified | Not verified | Not verified |
| GitHub Environment name | Not verified | Not verified | Not verified |
| Referenced secret names (names only) | Not verified | Not verified | Not verified |
| Latest deployment/run ID | Not verified | Not verified | Not verified |
| Latest deployment status | Not verified | Not verified | Not verified |
| Deployment timestamp | Not verified | Not verified | Not verified |
| Service URL from trusted source | Not verified | Not verified | Not verified |
| HTTP response code (safe read-only request) | Not checked | Not checked | Not checked |
| Response time | Not checked | Not checked | Not checked |
| Non-mutating functional check | Not checked | Not checked | Not checked |
| Deployment-to-commit SHA traceability | Not verified | Not verified | Not verified |
| Evidence links and verification date | Not recorded | Not recorded | Not recorded |

## 2. Evidence classification

| Class | Meaning | Minimum evidence |
|---|---|---|
| `Not configured` | No deployment configuration found in the inspected sources | Documented scope of inspection and absent configuration |
| `Configured, not executed` | Deployment configuration exists but no execution was found | Workflow/configuration plus scoped run-history query |
| `Deployment recorded` | A deployment execution or deployment record exists | Run/deployment ID, status, timestamp, commit |
| `Endpoint responds` | A trusted service URL returns an HTTP response | URL source, request time, response code and latency |
| `Operational evidence verified` | Deployment, endpoint response, and relevant non-mutating functional evidence align to the same release | All preceding evidence plus functional check and commit traceability |

A successful HTTP response alone does not establish application correctness, availability objectives, security, or production readiness.

## 3. Read-only inspection rules

- Inspect deployment workflows and their triggers; do not invoke `workflow_dispatch` or any deployment trigger.
- Inspect secret references by name only. Never retrieve, print, or copy secret values.
- Do not issue POST, PUT, PATCH, or DELETE requests to live services.
- Use only safe, non-mutating HTTP methods for endpoint probes.
- Do not run load, stress, fuzz, or destructive tests against deployed services.
- Do not modify GitHub Environments, deployment protection rules, DNS, infrastructure, or application settings.
- If a URL cannot be tied to a trusted repository/workflow/deployment source, record it as unverified.

## 4. Evidence capture template

For every claim, record:
- Repository and branch/ref.
- Workflow path or deployment provider.
- Run/deployment ID and final status.
- Commit SHA deployed.
- Environment and service URL, if evidenced.
- Date/time of observation (UTC).
- HTTP method, response code, and latency for a safe probe, if performed.
- Functional check name and result, if performed.
- Source URL and auditor.

## 5. Closure criteria

- [ ] Each repository has a classification from §2.
- [ ] Every classification is supported by source links and a verification timestamp.
- [ ] Deployment configuration is not confused with a successful deployment.
- [ ] Endpoint response is not confused with operational readiness.
- [ ] Missing evidence is explicitly marked `Unavailable` or `Not verified`.
- [ ] No deployment, secret access, write, or load test was performed.

# Zapier AI Template Adoption Plan — TLCE / QuestPulse

Status: design adaptation recorded on `feature/zapier-event-bridge`. No live Zap has been created or enabled.

## Ownership and boundaries

- The Last Cosmic Explosion (TLCE) remains the parent application and system of record.
- QuestPulse (Q.P) remains an internal TLCE module, not a standalone product.
- Zapier is an external automation/orchestration adapter only. It must not own canonical project data, authorization, business rules, or module lifecycle.
- Keep the current outbound-only, allowlisted event bridge as the integration boundary. Do not add a generic inbound command endpoint.
- Zero-spend operation is the default. No paid Zapier plan, trial conversion, OpenAI API usage, pay-per-task billing, or other paid service may be activated without explicit approval.

## Plan compatibility — verified 2026-11-19

Zapier's current official Free-plan documentation lists 100 tasks/month and two-step Zaps, but Webhooks by Zapier is not available on Free. The Professional plan lists Webhooks and multi-step Zaps as paid features. Therefore the current Catch Hook integration cannot be end-to-end tested on Free merely by creating a Free account.

- Do not enable a paid trial, paid plan, or pay-per-task billing.
- Do not describe ZAP-01 as free-tier compatible.
- Keep the TLCE adapter and mocked tests plan-independent.
- A no-cost prototype may explore Zapier Forms/Tables or other triggers explicitly shown as available in the user's Free account, but must not claim automatic TLCE event delivery until a compatible trigger is verified.
- Re-check plan availability and limits immediately before any live configuration because provider plans can change.

Official plan references:
- https://help.zapier.com/hc/en-us/articles/32337438839565-What-s-included-in-Zapier-s-Free-plan
- https://zapier.com/pricing
- https://help.zapier.com/hc/en-us/articles/8496288690317-Trigger-Zap-workflows-from-webhooks

## Zapier starter-kit patterns selected

The following official templates are patterns to adapt, not templates to import unchanged:

1. **Consolidated product feedback** — adapt to Q.P submission/feedback intake and classification. Keep canonical records in TLCE storage. Zapier Tables may hold only temporary operational state or delivery/deduplication metadata; it is not the system of record.
2. **Project management stakeholder communications** — adapt to internal project status digests. Generate a draft summary and require human approval before any external email or stakeholder notification. Do not assume Slack or Gmail are required; use only connected, approved destinations.
3. **Engineering request intake** — adapt to turn approved internal engineering requests into GitHub issue drafts. Require a human approval gate before creating issues or triggering repository changes.
4. **Daily market and competitive briefing** — optional future research workflow. Treat all collected external content as untrusted input, cite sources, and never allow it to modify project code, configuration, or roadmap automatically.

## Initial workflows

### ZAP-01 — Q.P event intake / notification (paid-plan gated)
- Trigger: Webhooks by Zapier Catch Hook. This trigger is not available on the current Free plan.
- Do not configure or activate until a plan including Webhooks is explicitly approved, or a verified free-compatible alternative is designed.
- Accept only the four event types already allowlisted in `docs/ZAPIER_EVENT_BRIDGE.md`.
- Filter by `event_type`; deduplicate by `event_id`.
- First destination: a non-sensitive test log/notification.
- Payloads must contain opaque references and approved fields only. No email, IP, session tokens, credentials, raw media URLs, full offer bodies, or moderation notes.

### ZAP-02 — Internal feedback triage
- Intake: approved synthetic/test feedback or a manually submitted internal feedback item.
- AI step: normalize into category, concise summary, severity, and suggested owner.
- Human review required before any roadmap, issue, moderation, or product-state change.
- Persist canonical feedback in TLCE-owned storage; do not move system-of-record ownership to Zapier Tables.
- Verify that the required AI step and connected apps are included in the chosen plan before designing an active Zap.

### ZAP-03 — Engineering request to GitHub draft
- Intake: approved internal engineering request.
- AI step: produce a structured issue title, context, acceptance criteria, and test notes.
- Human approval required before GitHub issue creation.
- This workflow must never merge PRs, deploy, alter secrets, or write to `main`.
- Verify GitHub app availability, AI-step availability, and task cost before activation.

### ZAP-04 — Weekly build/status digest
- Trigger: scheduled/manual staging run.
- Summarize verified repository/CI status and explicitly label unknowns.
- Draft only; no external sending until a human approves the exact recipients and content.
- Check schedule-trigger and destination availability on the active plan.

## Security and reliability gates

- Treat a Catch Hook URL as a password. Zapier documents it as protected by obscurity; anyone who obtains it can submit requests. Never place it in browser code, public repositories, screenshots, or client-side configuration.
- Keep Catch Hook URL and a separate signing secret in server-side secret storage only.
- Use a dedicated staging hook. Do not point Zapier at GitHub Pages, a guessed endpoint, or the Q.P prototype API.
- HMAC headers are generated by the TLCE adapter; do not assume Zapier Catch Hook verifies them. A TLCE-controlled receiver must verify signatures, reject stale timestamps, and enforce replay protection. The HMAC header alone does not authenticate a request to Zapier's Catch Hook.
- Delivery is at-least-once. Deduplicate on `event_id`; retain durable delivery state, bounded retries, and a dead-letter path in TLCE before production.
- Keep logs redacted and record event/correlation IDs and delivery outcomes in TLCE observability.
- Test with synthetic data only. Review data scope, retention, app permissions, plan limits, and provider terms before connecting any third-party destination.

## Rollout order

1. Keep the existing adapter and its tests on the feature branch.
2. Review this mapping and the event contract.
3. Preserve zero-spend status. Do not create a live Catch Hook unless plan eligibility and cost are explicitly approved.
4. If a verified Free-compatible prototype is available, test only with synthetic data and no sensitive destinations.
5. For a future paid-plan staging test, configure a dedicated Catch Hook manually and store its URL as a server-side secret.
6. Add durable delivery/replay/monitoring before enabling any business workflow.
7. Add ZAP-02 through ZAP-04 one at a time, each with explicit human approval gates.
8. Production activation, paid plans, external communications, merges, and deployments remain separate approval decisions.

## Source templates

- AI starter kit: https://zapier.com/templates/ai-workflows
- Consolidated product feedback: https://zapier.com/templates/details/consolidated-product-feedback
- Project management stakeholder communications: https://zapier.com/templates/details/project-management-stakeholder-communications
- Engineering request intake: https://zapier.com/templates/details/engineering-work-intake-slack-jira
- Daily market and competitive briefing: https://zapier.com/templates/details/daily-market-competitive-briefing-automation

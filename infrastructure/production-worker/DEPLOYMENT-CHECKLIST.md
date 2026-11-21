# Deployment readiness checklist

- [ ] Cloudflare Workers account is on the Free plan.
- [ ] SQLite-backed Durable Objects are available for the account.
- [ ] Cloudflare Access application protects the Worker hostname.
- [ ] Access application audience and team-domain values are configured as GitHub Actions secrets.
- [ ] Deployment token is scoped to Workers Scripts deployment for this account.
- [ ] Run the manual deployment workflow.
- [ ] Verify `/health` returns liveness status.
- [ ] Verify `/api/search?q=...` rejects unauthenticated requests.
- [ ] Verify authenticated requests return provider status and results.
- [ ] Do not connect the frontend until the Worker URL and Access login behavior are verified.
- [ ] Do not connect LLM7 until its official endpoint, model, credential and billing conditions are confirmed.

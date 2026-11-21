# TLCE Revenue Infrastructure

**Status:** Revenue-domain foundation only. No payment collection or production financial database is enabled.

## Scope

This module defines a provider-neutral ledger contract for revenue events, reconciliation, reporting and operating expenses. It deliberately does not collect card data, credentials, customer names, email addresses or wallet secrets.

## Revenue classifications

- Product and digital-tool sales
- Recurring subscriptions
- Developer/platform commissions
- Affiliate commissions
- Advertising
- Software and content licensing
- Digital services
- Sponsorships and partnerships
- Donations
- Other approved revenue

Refunds, chargebacks and disputes are transaction states/adjustments, not revenue sources.

## Accounting rules

- Store money as integer minor units with the ISO-4217 currency exponent; never use floating-point values.
- Never aggregate different currencies into one total.
- Only settled transactions contribute to recognized net revenue.
- Pending, disputed and void transactions contribute zero recognized revenue.
- Track tax collected separately; it is excluded from net revenue.
- Net revenue = gross - discounts - processor fees - refunds.
- Operating profit is calculated separately: net revenue - operating expenses.
- Enforce idempotency using provider + provider transaction ID before accepting an event.
- Preserve an append-only audit trail for imports, status changes, refunds and reconciliation decisions.

## Planned storage boundary

The PostgreSQL migration in `migrations/001_revenue_ledger.sql` is a proposed schema, not a live database. A production adapter must enforce server-side authorization, tenant isolation, encrypted backups, retention policy, audit immutability and reconciliation against provider statements.

## Release gates

1. Select payment and revenue providers; do not assume any provider is connected.
2. Provision a private backend and PostgreSQL database.
3. Implement authenticated ingestion and idempotency.
4. Reconcile settlement reports and refunds.
5. Add role-separated finance dashboard access and audit logs.
6. Publish no checkout or payment claims until a real provider integration is tested.

The public GitHub Pages site must never contain the financial ledger, provider credentials, private customer data or an unauthenticated finance dashboard.

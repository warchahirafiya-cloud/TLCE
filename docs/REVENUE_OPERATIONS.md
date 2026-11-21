# TLCE Revenue Operations and Reporting

**Status:** Technical foundation; not a live payment or accounting system.

## Revenue dashboard dimensions

The future finance dashboard must report separately by:
- Date range (day, month, quarter, year)
- Revenue source and product/module
- Currency
- Provider and settlement status
- Gross sales, discounts, processing fees, taxes, refunds and net revenue
- Operating expenses and operating profit

Never sum USD, EUR, DZD or other currencies without a documented exchange-rate source, rate timestamp and conversion policy.

## Source taxonomy

| Code | Source |
|---|---|
| product_sale | One-time product/app/tool sales |
| subscription | Recurring plans |
| developer_commission | TLCE share of approved developer sales |
| affiliate_commission | External affiliate commissions |
| advertising | Ad placements and sponsorship inventory sold as ads |
| licensing | Software/content usage licenses |
| digital_service | Paid digital services |
| sponsorship | Direct sponsorship and partnerships |
| donation | Voluntary contributions |
| other | Reviewed and documented exceptional income |

Refunds and chargebacks reduce recognized proceeds; they are not a separate income category.

## Core formulas

- Gross sales: sum of settled gross amounts.
- Net revenue: gross - discounts - processor fees - refunds.
- Taxes collected: tracked as a liability/clearing amount, not operating revenue.
- Operating profit: net revenue - paid operating expenses.
- Pending volume: visible separately and excluded from recognized revenue.

All calculations use integer minor units and are grouped by currency.

## Controls

- Only finance/admin roles may view or export the ledger.
- Ingestion must be server-to-server or authenticated; browser submissions are not authoritative.
- Enforce idempotency and unique provider transaction IDs.
- Reconcile imported transactions to provider settlement statements.
- Keep immutable audit events for manual adjustments and refund decisions.
- Do not store payment-card data, passwords, private keys, customer contact details or unnecessary personal data in the ledger.
- Use a separate private database; never commit real transactions to this public repository.
- Require dual review for manual adjustments above a configurable threshold.

## Current implementation boundary

The repository now contains typed validation and aggregation primitives, automated tests, a JSON event contract and a proposed PostgreSQL migration. No payment processor, database instance, authentication provider, finance UI or live revenue stream has been connected. Do not display projected or sample amounts as actual TLCE income.

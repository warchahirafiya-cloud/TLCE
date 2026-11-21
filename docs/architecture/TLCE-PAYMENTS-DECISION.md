# TLCE Card and Electronic Payments — Architecture Decision

**Decision:** Card and electronic payments are the primary checkout direction for TLCE STORE.

## Architecture
TLCE STORE -> Payment Orchestrator -> Provider-hosted checkout -> signed webhook -> payment order state machine -> revenue ledger -> restricted Finance Dashboard.

The public site remains static. All payment creation, provider credentials, webhook verification, order fulfillment and ledger writes must run in a private backend.

## Provider strategy
- Local Algeria route: assess Guiddini Pay for CIB/Edahabia and international Visa/Mastercard, subject to merchant eligibility, bank agreement, foreign-currency account where required, and legal/site requirements.
- International digital-goods route: assess Paddle as Merchant of Record, subject to supplier onboarding approval and supported product categories.
- PayPal: optional additional wallet after merchant receiving and withdrawal capabilities are verified.

No live provider is selected or integrated yet.

## Payment state machine
created -> requires_action/processing -> settled -> fulfilled
created/requires_action/processing -> failed/cancelled
settled -> partially_refunded/refunded/disputed

Only a verified provider settlement event with matching order ID, amount, currency and merchant account can mark an order paid. Fulfillment is idempotent. Refunds and disputes reverse or suspend access according to the product policy.

## Required controls
- Hosted checkout; no cardholder data stored or processed by TLCE.
- Signed webhooks verified against raw request bytes.
- Unique provider event and transaction IDs.
- Idempotency on order creation and webhook processing.
- Amount/currency/order/merchant validation.
- 3-D Secure when supported/required.
- Reconciliation against provider settlement reports.
- Audit trail for all manual finance adjustments.
- No secrets, ledger records or customer data in the public repository.

## Financial reporting
A settled payment creates a revenue ledger entry. Taxes, processor fees, discounts, refunds, chargebacks and settlement FX differences are separate dimensions. Revenue is grouped by currency and never summed across currencies without an explicit, timestamped conversion rate.

## Release gates
Legal status, merchant category, product eligibility, settlement bank/account, provider approval, contract/fees, sandbox access, webhook documentation, legal pages and production backend are prerequisites. The current GitHub Pages site is not a payment backend.

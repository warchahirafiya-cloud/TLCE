# TLCE Payment Infrastructure

**Status: provider-neutral implementation foundation. No live payment processor is connected and no customer can currently pay through this module.**

## Approved direction

Card and electronic payments are the primary checkout methods. The architecture supports:
- Algerian domestic cards (CIB and Edahabia) through an approved SATIM/acquiring-bank integration.
- International Visa and Mastercard through an eligible acquiring arrangement.
- Merchant-of-record checkout for eligible software and digital products.
- PayPal as an optional wallet method if the merchant account and buyer flows are approved.

## Provider assessment for an Algeria-based merchant

### Guiddini Pay — local acquiring integration candidate
The provider currently advertises CIB and Edahabia via SATIM, plus a newer Visa/Mastercard offer initially involving BDL and CPA. Its published eligibility requires an appropriate Algerian legal status, an account for settlement, and a compliant merchant website. The Visa/Mastercard offer requires a foreign-currency account and bank acceptance agreement. It states that card details are entered on SATIM's hosted secure page, not on the merchant website.

Official provider pages:
- https://guiddini.com/en/services/pay
- https://guiddini.com/en/services/pay/cib-edahabia
- https://guiddini.com/en/services/pay/visa-mastercard

Before selection, obtain written confirmation of legal eligibility, merchant category, supported digital goods, settlement currencies, fees, reserves, refunds, chargebacks, recurring billing, API/webhook specifications, sandbox and certification. The provider's own current page describes the Visa/Mastercard offer as a company-under-Algerian-law offer with partner banks BDL and CPA.

### Paddle — international Merchant of Record candidate
Paddle documents selling in 200+ buyer countries and handling applicable sales tax/VAT as Merchant of Record. Supplier eligibility is a separate approval question: confirm that the legal entity, product category, payout route and account are accepted before building a live integration. It is generally more suitable for software/SaaS/digital goods than a general marketplace with third-party sellers.

Official docs:
- https://developer.paddle.com/concepts/sell/supported-countries-locales/
- https://www.paddle.com/help/start/account-verification/which-countries-are-supported-by-paddle

### PayPal — optional wallet candidate
Do not treat a PayPal personal account or a checkout button as proof that commercial card acquiring and withdrawals are enabled. Confirm Business account receiving, card acceptance, currency holding, withdrawal destination and digital-goods policy directly in the merchant account.

## Legal and launch gates

Algerian e-commerce rules may impose registration, website/domain/hosting, disclosure, invoicing, transaction-record and payment-platform requirements. A recent provider guide summarises Law 18-05 as requiring registration and, for its domestic e-commerce scope, a website hosted in Algeria with a .com.dz extension. This needs independent legal review for TLCE's exact business model and international digital-sales structure before taking payments. The current tlce.store + GitHub Pages setup must not be assumed to satisfy every Algerian domestic e-commerce requirement.

No provider is selected or connected until:
1. Merchant legal status and business activity are confirmed.
2. Settlement account and currency are confirmed.
3. Provider approves the merchant, product types and countries.
4. Fees, payout timing, reserves, refunds and chargeback rules are reviewed.
5. Signed API documentation, webhook signature rules and sandbox credentials are obtained.
6. HTTPS, legal pages, privacy notice, terms, refund policy and invoice process are ready.

## Security model

- Hosted checkout only. Card number, expiry and CVV never enter TLCE-controlled pages or APIs.
- API credentials remain in server-side secret storage and are never committed to Git or shipped to GitHub Pages.
- The browser return URL is informational only; never grant product access from a success redirect.
- Verify webhook signatures against the raw request body using the provider's official algorithm.
- Persist webhook event IDs and provider transaction IDs with unique constraints.
- Make webhook handling idempotent and safe under retries and out-of-order delivery.
- Verify amount, currency, merchant account, order ID and final settlement status before fulfilling.
- Reconcile captured/settled amounts against provider settlement reports.
- Keep refunds, partial refunds, disputes, chargebacks, fees and tax as distinct ledger fields.
- Never log PAN, CVV, authentication secrets, raw payment credentials or unnecessary customer personal data.

## Deployment boundary

GitHub Pages is a static frontend and cannot securely host provider secrets or authoritative payment webhooks. Production checkout requires a private backend/API, authenticated database, webhook endpoint, role-based finance access and secret manager. The browser may only receive a short-lived checkout URL and non-sensitive order status.

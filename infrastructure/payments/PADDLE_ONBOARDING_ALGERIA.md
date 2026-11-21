# Paddle onboarding — TLCE (Algeria)

**Current merchant status:** individual project; no Algerian commercial registration.

**Provider decision:** Paddle is the first candidate to evaluate for eligible international software/SaaS/digital products, as a Merchant of Record. This is conditional, not confirmation that the individual account, Algerian payout route, TLCE domain, or product catalogue has been accepted. Paddle's public guidance says business verification is not required for individuals/sole traders, while identity verification still applies. Algeria is not named in Paddle's current supplier unsupported-country list; final eligibility remains subject to onboarding and payout approval.

Official references:
- Supplier eligibility: https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle
- Supported buyer countries: https://developer.paddle.com/concepts/sell/supported-countries-locales/
- Account verification: https://www.paddle.com/help/start/account-verification/what-is-account-verification
- Identity verification: https://www.paddle.com/help/start/account-verification/what-is-identity-verification

## Onboarding sequence
1. Apply as an individual/sole trader using truthful Algerian residence and identity information.
2. Describe TLCE products precisely. Paddle is a candidate for software and eligible digital products; do not assume it supports a general marketplace, physical goods, financial products, crypto services, or third-party seller payouts.
3. Submit https://tlce.store/ for domain review and ensure product descriptions, pricing, terms, privacy, refund and support details are complete.
4. Obtain written acceptance for the individual seller profile, product categories, and Algeria-based supplier.
5. Verify the payout beneficiary and supported payout rail for Algeria before processing customer payments. Do not assume a local bank account or PayPal withdrawal is supported.
6. Use Paddle sandbox credentials first. Complete checkout, webhook signature, duplicate event, refund and reconciliation tests.
7. Enable live checkout only after provider approval, payout verification, and independent legal review.

## Legal boundary in Algeria
Law No. 18-05, Article 8, states that e-commerce activity is subject to registration in the commercial register or the register of crafts and trades as applicable, and that the published website/page for the domestic e-commerce scope must be hosted in Algeria with a .com.dz extension. Articles 10–12 add electronic offer/contract and domain-registration requirements. Article 7 separately addresses certain cross-border electronic sales and remittance. A foreign Merchant of Record does not automatically exempt the TLCE operator from Algerian obligations. Obtain advice from an Algerian accountant/lawyer or the competent CNRC/tax authority on whether TLCE's exact international digital-sales model requires registration, a .com.dz site/Algerian hosting, tax registration, invoicing or other approvals before launch.

Official law text: https://www.mpt.gov.dz/wp-content/uploads/2023/11/Loi-n%C2%B0-18-05-ar.pdf

## Current integration state
- Provider-neutral checkout contracts exist in core/payments/src/contracts.ts.
- Paddle onboarding readiness gate exists in core/payments/src/paddle-readiness.ts.
- No Paddle SDK, API key, client token, webhook secret, sandbox account or live account has been connected.
- No checkout button should claim to accept payment until a private backend and verified webhook are deployed.
- GitHub Pages is static; it must never contain Paddle API secrets or authoritative payment processing.

Required server-side secrets (names only; values belong in the backend secret manager):
- PADDLE_ENVIRONMENT (sandbox or production)
- PADDLE_VENDOR_ID
- PADDLE_API_KEY
- PADDLE_CLIENT_TOKEN
- PADDLE_WEBHOOK_SECRET

Paddle checkout should use Paddle Price IDs, not client-supplied amounts. The backend maps a TLCE product/price to an approved Paddle Price ID, creates the transaction, and returns the hosted checkout URL. Webhook handling verifies the signature against the raw body and checks transaction status, currency, total, product/price, and order metadata before the revenue ledger is updated.

## Local Algerian cards
Guiddini Pay remains the target candidate for CIB/Edahabia after TLCE obtains an eligible legal status (for example, a valid auto-entrepreneur card if the activity qualifies) and its acquiring file is approved. Its international Visa/Mastercard offer is described for Algerian-law companies and partner-bank arrangements; do not assume an unregistered individual qualifies.

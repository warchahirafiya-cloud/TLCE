# TLCE Card and Electronic Payments — Architecture Decision

**Decision:** Card and electronic payments are the primary checkout direction.

## Merchant status and provider selection
The owner states that TLCE is currently a personal project with no commercial registration.
- **First provider to evaluate:** Paddle, conditionally, for eligible international software/SaaS/digital products as Merchant of Record. Individual identity verification applies; business verification may not be required for individuals/sole traders. This does not guarantee Algeria supplier acceptance or a supported payout method.
- **Local cards later:** Guiddini Pay for CIB/Edahabia after obtaining an eligible legal status and provider/bank approval. Its current published Visa/Mastercard offer is for Algerian-law companies with partner-bank arrangements.
- **PayPal:** optional only after account-level receiving and withdrawal eligibility is verified.

No provider is currently selected as a live processor. Paddle is the onboarding candidate only.

## Algerian legal gate
Law 18-05 Article 8 states e-commerce activity is subject to registration in the commercial register or register of crafts and trades as applicable; it also specifies Algeria-hosted website/page and .com.dz extension for its domestic e-commerce scope. Article 7 separately addresses specified cross-border electronic transactions. A foreign Merchant of Record does not itself prove exemption from Algerian obligations. Obtain competent Algerian legal/accounting advice before accepting sales.
Official law: https://www.mpt.gov.dz/wp-content/uploads/2023/11/Loi-n%C2%B0-18-05-ar.pdf

## Architecture
TLCE STORE -> private payment backend -> Paddle-hosted checkout -> signed webhook -> order state machine -> revenue ledger -> restricted Finance Dashboard.
GitHub Pages remains static. All secrets, checkout creation, webhook verification, fulfilment and ledger writes must be on a private backend.

## Release gates
1. Paddle approves individual supplier, TLCE domain, product category and Algeria-based operation.
2. A supported payout beneficiary/method is verified.
3. Legal obligations for the exact business model are confirmed.
4. Sandbox credentials and official webhook documentation are obtained.
5. Backend, database, secret manager, privacy/terms/refund/support pages are ready.
6. Signed webhook, idempotency, amount/currency/order checks and refund reconciliation pass tests.

Until then, no real checkout is enabled and no live payment is claimed.

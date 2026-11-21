/**
 * Paddle onboarding readiness gate. This does not call Paddle.
 * Run only in a private backend; never expose credentials in browser code.
 */
export interface PaddleReadinessInput {
  vendorId?: string;
  apiKey?: string;
  clientToken?: string;
  webhookSecret?: string;
  approvedForLiveSales: boolean;
  payoutMethodVerified: boolean;
  domainApproved: boolean;
}
export interface PaddleReadiness {
  readyForSandbox: boolean;
  readyForLiveCheckout: boolean;
  blockers: string[];
}
export function assessPaddleReadiness(input: PaddleReadinessInput): PaddleReadiness {
  const blockers: string[] = [];
  if (!input.vendorId?.trim()) blockers.push("PADDLE_VENDOR_ID is missing");
  if (!input.apiKey?.trim()) blockers.push("PADDLE_API_KEY is missing");
  if (!input.clientToken?.trim()) blockers.push("PADDLE_CLIENT_TOKEN is missing");
  if (!input.webhookSecret?.trim()) blockers.push("PADDLE_WEBHOOK_SECRET is missing");
  if (!input.domainApproved) blockers.push("Paddle domain review is not approved");
  if (!input.payoutMethodVerified) blockers.push("Payout method and beneficiary verification are incomplete");
  if (!input.approvedForLiveSales) blockers.push("Paddle has not approved live selling for this account and product category");
  const hasCredentials = Boolean(input.vendorId?.trim() && input.apiKey?.trim() && input.clientToken?.trim() && input.webhookSecret?.trim());
  return {
    readyForSandbox: hasCredentials && input.domainApproved,
    readyForLiveCheckout: hasCredentials && input.domainApproved && input.payoutMethodVerified && input.approvedForLiveSales,
    blockers,
  };
}

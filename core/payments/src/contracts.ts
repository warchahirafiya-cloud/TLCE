export const PAYMENT_PROVIDERS = ["guiddini_pay", "paddle", "paypal"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
  "created", "requires_action", "processing", "authorized", "settled",
  "failed", "cancelled", "refunded", "partially_refunded", "disputed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentMethod = "card" | "paypal_wallet" | "unknown";

export interface CreateCheckoutRequest {
  orderId: string;
  idempotencyKey: string;
  amountMinor: number;
  currency: string;
  currencyExponent: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  customerReference?: string;
}

export interface CheckoutSession {
  provider: PaymentProvider;
  providerSessionId: string;
  checkoutUrl: string;
  expiresAt?: string;
}

export interface VerifiedPaymentEvent {
  provider: PaymentProvider;
  providerEventId: string;
  providerTransactionId: string;
  orderId: string;
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  occurredAt: string;
  refundAmountMinor?: number;
  signatureVerified: true;
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;
  createCheckout(request: CreateCheckoutRequest): Promise<CheckoutSession>;
  verifyWebhook(rawBody: Uint8Array, headers: Record<string, string>): Promise<VerifiedPaymentEvent>;
}

/** Provider adapters must be implemented server-side only. Never place API secrets in browser bundles. */
export function validateCheckoutRequest(request: CreateCheckoutRequest): string[] {
  const errors: string[] = [];
  if (!request.orderId.trim()) errors.push("orderId is required");
  if (!request.idempotencyKey.trim()) errors.push("idempotencyKey is required");
  if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor <= 0) errors.push("amountMinor must be a positive safe integer");
  if (!/^[A-Z]{3}$/.test(request.currency)) errors.push("currency must be a three-letter uppercase ISO code");
  if (!Number.isInteger(request.currencyExponent) || request.currencyExponent < 0 || request.currencyExponent > 3) errors.push("currencyExponent must be between 0 and 3");
  for (const [name, value] of [["successUrl", request.successUrl], ["cancelUrl", request.cancelUrl]] as const) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") errors.push(name + " must use HTTPS");
    } catch {
      errors.push(name + " must be a valid URL");
    }
  }
  if (!request.productName.trim()) errors.push("productName is required");
  return errors;
}

/** A browser redirect is never proof of payment. Only a verified provider event may settle an order. */
export function maySettlePayment(event: VerifiedPaymentEvent): boolean {
  return event.signatureVerified === true
    && event.status === "settled"
    && Number.isSafeInteger(event.amountMinor)
    && event.amountMinor > 0
    && /^[A-Z]{3}$/.test(event.currency)
    && Boolean(event.providerEventId.trim())
    && Boolean(event.providerTransactionId.trim())
    && Boolean(event.orderId.trim())
    && Number.isFinite(Date.parse(event.occurredAt));
}

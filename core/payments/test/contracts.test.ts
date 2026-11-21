import assert from "node:assert/strict";
import test from "node:test";
import { maySettlePayment, validateCheckoutRequest, type VerifiedPaymentEvent } from "../src/contracts.js";

const request = {
  orderId: "order_001",
  idempotencyKey: "order_001:checkout",
  amountMinor: 1999,
  currency: "USD",
  currencyExponent: 2,
  productName: "TLCE Digital Product",
  successUrl: "https://tlce.store/order/success",
  cancelUrl: "https://tlce.store/cart",
};

test("accepts a valid hosted-checkout request", () => {
  assert.deepEqual(validateCheckoutRequest(request), []);
});

test("rejects insecure callback URLs, invalid currency and invalid amount", () => {
  const errors = validateCheckoutRequest({ ...request, successUrl: "http://tlce.store/ok", currency: "usd", amountMinor: 0 });
  assert.ok(errors.some((error) => error.includes("HTTPS")));
  assert.ok(errors.some((error) => error.includes("currency")));
  assert.ok(errors.some((error) => error.includes("amountMinor")));
});

test("settles only a verified provider event with valid identifiers and amount", () => {
  const event: VerifiedPaymentEvent = {
    provider: "guiddini_pay",
    providerEventId: "evt_001",
    providerTransactionId: "txn_001",
    orderId: "order_001",
    status: "settled",
    amountMinor: 1999,
    currency: "DZD",
    occurredAt: "2026-11-21T10:00:00.000Z",
    signatureVerified: true,
  };
  assert.equal(maySettlePayment(event), true);
  assert.equal(maySettlePayment({ ...event, signatureVerified: false }), false);
  assert.equal(maySettlePayment({ ...event, status: "processing" }), false);
  assert.equal(maySettlePayment({ ...event, amountMinor: 0 }), false);
  assert.equal(maySettlePayment({ ...event, orderId: "" }), false);
});

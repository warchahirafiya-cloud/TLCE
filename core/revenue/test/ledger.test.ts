import assert from "node:assert/strict";
import test from "node:test";
import { netRevenueMinor, summarizeRevenue, validateRevenueRecord, type RevenueRecord } from "../src/ledger.js";

const base: RevenueRecord = {
  id: "rev_001",
  idempotencyKey: "provider:txn_001",
  source: "product_sale",
  status: "settled",
  currency: "USD",
  currencyExponent: 2,
  grossMinor: 2500,
  discountMinor: 200,
  processingFeeMinor: 100,
  taxMinor: 150,
  refundMinor: 300,
  provider: "manual_import",
  providerTransactionId: "txn_001",
  occurredAt: "2026-11-21T10:00:00.000Z",
  settledAt: "2026-11-21T10:01:00.000Z",
  productId: "tool-001",
};

test("validates a settled revenue record", () => {
  assert.deepEqual(validateRevenueRecord(base), []);
});

test("rejects invalid money, currency and excessive refunds", () => {
  const invalid = { ...base, currency: "usd", grossMinor: -1, refundMinor: 5000 };
  const errors = validateRevenueRecord(invalid);
  assert.ok(errors.some((item) => item.includes("currency")));
  assert.ok(errors.some((item) => item.includes("grossMinor")));
  assert.ok(errors.some((item) => item.includes("refundMinor")));
});

test("counts net revenue only after settlement and excludes tax", () => {
  assert.equal(netRevenueMinor(base), 1750);
  assert.equal(netRevenueMinor({ ...base, status: "pending", settledAt: undefined }), 0);
  assert.equal(netRevenueMinor({ ...base, status: "disputed" }), 0);
});

test("summarizes by currency and revenue source without mixing currencies", () => {
  const usd = base;
  const pending = { ...base, id: "rev_002", status: "pending" as const, settledAt: undefined };
  const eur = { ...base, id: "rev_003", currency: "EUR", grossMinor: 1000, discountMinor: 0, processingFeeMinor: 0, taxMinor: 0, refundMinor: 0 };
  const result = summarizeRevenue([usd, pending, eur]);
  assert.equal(result.length, 2);
  assert.equal(result.find((item) => item.currency === "USD")?.netRevenueMinor, 1750);
  assert.equal(result.find((item) => item.currency === "USD")?.pendingTransactions, 1);
  assert.equal(result.find((item) => item.currency === "EUR")?.netRevenueMinor, 1000);
});

test("rejects inconsistent currency exponents in one summary", () => {
  assert.throws(() => summarizeRevenue([base, { ...base, id: "rev_004", currencyExponent: 3 }]), /exponent mismatch/);
});

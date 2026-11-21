export const REVENUE_SOURCES = [
  "product_sale",
  "subscription",
  "developer_commission",
  "affiliate_commission",
  "advertising",
  "licensing",
  "digital_service",
  "sponsorship",
  "donation",
  "other",
] as const;

export const REVENUE_STATUSES = [
  "pending",
  "settled",
  "refunded",
  "disputed",
  "void",
] as const;

export type RevenueSource = (typeof REVENUE_SOURCES)[number];
export type RevenueStatus = (typeof REVENUE_STATUSES)[number];

export interface RevenueRecord {
  id: string;
  idempotencyKey: string;
  source: RevenueSource;
  status: RevenueStatus;
  currency: string;
  currencyExponent: number;
  grossMinor: number;
  discountMinor: number;
  processingFeeMinor: number;
  taxMinor: number;
  refundMinor: number;
  provider: string;
  providerTransactionId: string;
  occurredAt: string;
  settledAt?: string;
  productId?: string;
}

export interface CurrencyRevenueSummary {
  currency: string;
  currencyExponent: number;
  settledTransactions: number;
  pendingTransactions: number;
  grossMinor: number;
  discountMinor: number;
  processingFeeMinor: number;
  taxMinor: number;
  refundMinor: number;
  netRevenueMinor: number;
  bySource: Partial<Record<RevenueSource, number>>;
}

const SOURCES = new Set<string>(REVENUE_SOURCES);
const STATUSES = new Set<string>(REVENUE_STATUSES);
const AMOUNT_FIELDS = [
  "grossMinor",
  "discountMinor",
  "processingFeeMinor",
  "taxMinor",
  "refundMinor",
] as const;

export function validateRevenueRecord(record: RevenueRecord): string[] {
  const errors: string[] = [];
  if (!record.id.trim()) errors.push("id is required");
  if (!record.idempotencyKey.trim()) errors.push("idempotencyKey is required");
  if (!SOURCES.has(record.source)) errors.push("source is not supported");
  if (!STATUSES.has(record.status)) errors.push("status is not supported");
  if (!/^[A-Z]{3}$/.test(record.currency)) errors.push("currency must be a three-letter uppercase ISO code");
  if (!Number.isInteger(record.currencyExponent) || record.currencyExponent < 0 || record.currencyExponent > 3) {
    errors.push("currencyExponent must be an integer from 0 to 3");
  }
  for (const field of AMOUNT_FIELDS) {
    const value = record[field];
    if (!Number.isSafeInteger(value) || value < 0) errors.push(field + " must be a non-negative safe integer");
  }
  if (record.discountMinor > record.grossMinor) errors.push("discountMinor cannot exceed grossMinor");
  if (record.refundMinor > record.grossMinor - record.discountMinor) {
    errors.push("refundMinor cannot exceed the discounted gross amount");
  }
  if (!record.provider.trim()) errors.push("provider is required");
  if (!record.providerTransactionId.trim()) errors.push("providerTransactionId is required");
  if (!Number.isFinite(Date.parse(record.occurredAt))) errors.push("occurredAt must be a valid timestamp");
  if (record.status === "settled" && (!record.settledAt || !Number.isFinite(Date.parse(record.settledAt)))) {
    errors.push("settled records require a valid settledAt timestamp");
  }
  if (record.settledAt && !Number.isFinite(Date.parse(record.settledAt))) errors.push("settledAt must be a valid timestamp");
  return errors;
}

/** Net revenue is reported only after settlement. Taxes are tracked separately and excluded. */
export function netRevenueMinor(record: RevenueRecord): number {
  if (record.status !== "settled") return 0;
  return Math.max(
    0,
    record.grossMinor - record.discountMinor - record.processingFeeMinor - record.refundMinor,
  );
}

/** Aggregates by currency so unlike currencies are never added together. */
export function summarizeRevenue(records: RevenueRecord[]): CurrencyRevenueSummary[] {
  const summaries = new Map<string, CurrencyRevenueSummary>();
  for (const record of records) {
    const key = record.currency;
    let summary = summaries.get(key);
    if (!summary) {
      summary = {
        currency: record.currency,
        currencyExponent: record.currencyExponent,
        settledTransactions: 0,
        pendingTransactions: 0,
        grossMinor: 0,
        discountMinor: 0,
        processingFeeMinor: 0,
        taxMinor: 0,
        refundMinor: 0,
        netRevenueMinor: 0,
        bySource: {},
      };
      summaries.set(key, summary);
    }
    if (summary.currencyExponent !== record.currencyExponent) {
      throw new Error("Currency exponent mismatch for " + key);
    }
    if (record.status === "pending") summary.pendingTransactions += 1;
    if (record.status !== "settled") continue;
    summary.settledTransactions += 1;
    summary.grossMinor += record.grossMinor;
    summary.discountMinor += record.discountMinor;
    summary.processingFeeMinor += record.processingFeeMinor;
    summary.taxMinor += record.taxMinor;
    summary.refundMinor += record.refundMinor;
    summary.netRevenueMinor += netRevenueMinor(record);
    summary.bySource[record.source] = (summary.bySource[record.source] ?? 0) + 1;
  }
  return [...summaries.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

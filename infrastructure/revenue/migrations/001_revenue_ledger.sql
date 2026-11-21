-- Proposed PostgreSQL schema. Not applied to a live database.
CREATE TABLE revenue_transactions (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL CHECK (source IN (
    'product_sale','subscription','developer_commission','affiliate_commission',
    'advertising','licensing','digital_service','sponsorship','donation','other'
  )),
  status TEXT NOT NULL CHECK (status IN ('pending','settled','refunded','disputed','void')),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  currency_exponent SMALLINT NOT NULL CHECK (currency_exponent BETWEEN 0 AND 3),
  gross_minor BIGINT NOT NULL CHECK (gross_minor >= 0),
  discount_minor BIGINT NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  processing_fee_minor BIGINT NOT NULL DEFAULT 0 CHECK (processing_fee_minor >= 0),
  tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  refund_minor BIGINT NOT NULL DEFAULT 0 CHECK (refund_minor >= 0),
  provider TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  product_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT revenue_discount_not_over_gross CHECK (discount_minor <= gross_minor),
  CONSTRAINT revenue_refund_not_over_net_gross CHECK (refund_minor <= gross_minor - discount_minor),
  CONSTRAINT revenue_provider_transaction_unique UNIQUE (provider, provider_transaction_id)
);

CREATE INDEX revenue_transactions_settled_at_idx
  ON revenue_transactions (settled_at) WHERE status = 'settled';
CREATE INDEX revenue_transactions_source_status_idx
  ON revenue_transactions (source, status);
CREATE INDEX revenue_transactions_product_idx
  ON revenue_transactions (product_id) WHERE product_id IS NOT NULL;

CREATE TABLE operating_expenses (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN (
    'hosting','domain','software','payment_processing','marketing',
    'contractor','support','legal','tax_advisory','other'
  )),
  status TEXT NOT NULL CHECK (status IN ('planned','paid','void')),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  currency_exponent SMALLINT NOT NULL CHECK (currency_exponent BETWEEN 0 AND 3),
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  vendor_reference TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE revenue_audit_events (
  id BIGSERIAL PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES revenue_transactions(id),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  evidence_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Do not grant public/anonymous access. Production roles and grants must be
-- defined only after the identity provider and deployment environment exist.

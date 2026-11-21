-- Proposed PostgreSQL schema only. Not applied to a live database.
CREATE TABLE payment_orders (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  order_reference TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  revenue_source TEXT NOT NULL CHECK (revenue_source IN ('product_sale','subscription','developer_commission','licensing','digital_service')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  currency_exponent SMALLINT NOT NULL CHECK (currency_exponent BETWEEN 0 AND 3),
  status TEXT NOT NULL CHECK (status IN ('created','pending','paid','cancelled','fulfilled','partially_refunded','refunded','disputed')),
  customer_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES payment_orders(id),
  provider TEXT NOT NULL CHECK (provider IN ('guiddini_pay','paddle','paypal')),
  provider_session_id TEXT,
  provider_transaction_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('created','requires_action','processing','authorized','settled','failed','cancelled','refunded','partially_refunded','disputed')),
  checkout_url TEXT,
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  currency CHAR(3) NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_session_id),
  UNIQUE (provider, provider_transaction_id)
);

CREATE TABLE payment_webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('guiddini_pay','paddle','paypal')),
  provider_event_id TEXT NOT NULL,
  provider_transaction_id TEXT,
  order_id TEXT REFERENCES payment_orders(id),
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('received','processed','ignored','failed')),
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX payment_orders_status_created_idx ON payment_orders (status, created_at);
CREATE INDEX payment_attempts_order_idx ON payment_attempts (order_id, created_at DESC);
CREATE INDEX payment_webhook_events_unprocessed_idx ON payment_webhook_events (received_at) WHERE processing_status IN ('received','failed');

-- Secrets must be stored in a server-side secret manager. Never add secret values here.
-- Restrict all tables to backend service roles; no anonymous/public database grants.

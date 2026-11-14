-- TLCE durable event delivery and dead-letter persistence (PostgreSQL)
-- Apply through the deployment migration runner; this repository does not run migrations automatically.

CREATE TABLE IF NOT EXISTS tlce_event_deduplication (
  dedupe_key VARCHAR(512) PRIMARY KEY,
  status VARCHAR(16) NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  lease_until TIMESTAMPTZ NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((status = 'in_progress' AND lease_until IS NOT NULL) OR
         (status IN ('completed', 'failed') AND lease_until IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_tlce_event_deduplication_lease
  ON tlce_event_deduplication (lease_until)
  WHERE status = 'in_progress';

CREATE TABLE IF NOT EXISTS tlce_dead_letters (
  event_id VARCHAR(128) PRIMARY KEY,
  event_type VARCHAR(128) NOT NULL,
  producer_module VARCHAR(128) NOT NULL,
  event_data JSONB NOT NULL,
  failure_data JSONB NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tlce_dead_letters_failed_at
  ON tlce_dead_letters (failed_at DESC);

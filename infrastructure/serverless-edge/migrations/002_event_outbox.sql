-- TLCE transactional event outbox (PostgreSQL)
-- Producers must insert the outbox row in the same DB transaction as their domain write.

CREATE TABLE IF NOT EXISTS tlce_event_outbox (
  event_id VARCHAR(128) PRIMARY KEY,
  event_type VARCHAR(128) NOT NULL,
  producer_module VARCHAR(128) NOT NULL,
  partition_key VARCHAR(128) NULL,
  event_data JSONB NOT NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('pending', 'in_progress', 'published')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lease_owner VARCHAR(128) NULL,
  lease_until TIMESTAMPTZ NULL,
  last_error VARCHAR(500) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMPTZ NULL,
  CHECK ((status = 'in_progress' AND lease_owner IS NOT NULL AND lease_until IS NOT NULL) OR
         (status <> 'in_progress' AND lease_owner IS NULL AND lease_until IS NULL)),
  CHECK ((status = 'published' AND published_at IS NOT NULL) OR
         (status <> 'published' AND published_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_tlce_event_outbox_pending
  ON tlce_event_outbox (available_at, created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_tlce_event_outbox_expired
  ON tlce_event_outbox (lease_until)
  WHERE status = 'in_progress';

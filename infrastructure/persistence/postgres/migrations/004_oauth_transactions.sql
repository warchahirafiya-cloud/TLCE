-- Short-lived, one-time OAuth authorization state.
-- Only SHA-256 state digests are persisted.
CREATE TABLE IF NOT EXISTS tlce_oauth_transactions (
  state_hash CHAR(64) PRIMARY KEY
    CHECK (state_hash ~ '^[a-f0-9]{64}$'),
  provider VARCHAR(32) NOT NULL
    CHECK (provider IN ('github')),
  redirect_uri TEXT NOT NULL
    CHECK (redirect_uri LIKE 'https://%'),
  created_at_ms BIGINT NOT NULL CHECK (created_at_ms >= 0),
  expires_at_ms BIGINT NOT NULL CHECK (expires_at_ms > created_at_ms)
);

CREATE INDEX IF NOT EXISTS tlce_oauth_transactions_expiry_idx
  ON tlce_oauth_transactions (expires_at_ms);

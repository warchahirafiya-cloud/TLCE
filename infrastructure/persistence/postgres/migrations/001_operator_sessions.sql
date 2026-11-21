-- TLCE operator sessions. Apply through the repository's migration runner.
-- Raw session/CSRF tokens are never stored; only fixed-length SHA-256 digests.
CREATE TABLE IF NOT EXISTS tlce_operator_sessions (
  session_token_hash CHAR(64) PRIMARY KEY
    CHECK (session_token_hash ~ '^[a-f0-9]{64}$'),
  subject VARCHAR(200) NOT NULL
    CHECK (subject ~ '^[A-Za-z0-9._:@-]{1,200}$'),
  roles JSONB NOT NULL
    CHECK (jsonb_typeof(roles) = 'array' AND jsonb_array_length(roles) > 0),
  allowed_module_ids JSONB NOT NULL
    CHECK (jsonb_typeof(allowed_module_ids) = 'array'),
  csrf_token_hash CHAR(64) NOT NULL
    CHECK (csrf_token_hash ~ '^[a-f0-9]{64}$'),
  created_at_ms BIGINT NOT NULL CHECK (created_at_ms >= 0),
  last_seen_at_ms BIGINT NOT NULL CHECK (last_seen_at_ms >= created_at_ms),
  idle_expires_at_ms BIGINT NOT NULL,
  absolute_expires_at_ms BIGINT NOT NULL,
  CHECK (idle_expires_at_ms <= absolute_expires_at_ms),
  CHECK (absolute_expires_at_ms > created_at_ms)
);

CREATE INDEX IF NOT EXISTS tlce_operator_sessions_expiry_idx
  ON tlce_operator_sessions (absolute_expires_at_ms, idle_expires_at_ms);

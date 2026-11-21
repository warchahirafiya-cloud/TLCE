-- TOTP seeds are envelope-encrypted by the external KMS before reaching PostgreSQL.
-- The application database must never store plaintext authenticator secrets.
CREATE TABLE IF NOT EXISTS tlce_totp_factors (
  subject VARCHAR(200) PRIMARY KEY,
  ciphertext TEXT NOT NULL,
  key_version VARCHAR(256) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_accepted_step BIGINT NOT NULL DEFAULT -1 CHECK (last_accepted_step >= -1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(ciphertext) > 0),
  CHECK (length(key_version) > 0)
);

CREATE INDEX IF NOT EXISTS tlce_totp_factors_enabled_idx
  ON tlce_totp_factors (enabled) WHERE enabled = TRUE;

-- Restrict access to the application role in deployment-specific grants:
-- GRANT SELECT, INSERT, UPDATE, DELETE ON tlce_totp_factors TO tlce_app;
-- Do not grant this table to analytics, reporting, or read-only support roles.

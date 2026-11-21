-- One-time, short-lived MFA challenges. Raw challenge tokens and TOTP secrets are never stored here.
CREATE TABLE IF NOT EXISTS tlce_mfa_challenges (
  challenge_token_hash CHAR(64) PRIMARY KEY
    CHECK (challenge_token_hash ~ '^[a-f0-9]{64}$'),
  subject VARCHAR(200) NOT NULL
    CHECK (subject ~ '^[A-Za-z0-9._:@-]{1,200}$'),
  roles JSONB NOT NULL
    CHECK (jsonb_typeof(roles) = 'array' AND jsonb_array_length(roles) > 0),
  allowed_module_ids JSONB NOT NULL
    CHECK (jsonb_typeof(allowed_module_ids) = 'array'),
  created_at_ms BIGINT NOT NULL CHECK (created_at_ms >= 0),
  expires_at_ms BIGINT NOT NULL CHECK (expires_at_ms > created_at_ms),
  attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 10)
);

CREATE INDEX IF NOT EXISTS tlce_mfa_challenges_expiry_idx
  ON tlce_mfa_challenges (expires_at_ms);

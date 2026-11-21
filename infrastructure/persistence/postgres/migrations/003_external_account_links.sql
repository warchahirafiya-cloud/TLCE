-- Pre-provisioned provider-account to TLCE-subject links.
-- This table does not auto-provision users or assign roles.
CREATE TABLE IF NOT EXISTS tlce_external_account_links (
  provider VARCHAR(32) NOT NULL
    CHECK (provider IN ('github')),
  provider_subject VARCHAR(32) NOT NULL
    CHECK (provider_subject ~ '^[0-9]{1,32}$'),
  tlce_subject VARCHAR(200) NOT NULL
    CHECK (tlce_subject ~ '^[A-Za-z0-9._:@-]{1,200}$'),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS tlce_external_account_links_subject_idx
  ON tlce_external_account_links (tlce_subject);

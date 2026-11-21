-- TLCE append-only audit events.
-- Use a dedicated runtime DB role with INSERT privileges only.
CREATE TABLE IF NOT EXISTS tlce_audit_records (
  audit_id VARCHAR(128) PRIMARY KEY
    CHECK (audit_id ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$'),
  occurred_at TIMESTAMPTZ NOT NULL,
  request_id VARCHAR(128) NOT NULL
    CHECK (request_id ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$'),
  actor_id VARCHAR(128) NOT NULL
    CHECK (actor_id ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$'),
  actor_type VARCHAR(16) NOT NULL
    CHECK (actor_type IN ('user', 'service', 'module', 'system')),
  module_id VARCHAR(128) NOT NULL
    CHECK (module_id ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$'),
  action VARCHAR(128) NOT NULL
    CHECK (action ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$'),
  resource_type VARCHAR(128) NOT NULL
    CHECK (resource_type ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$'),
  resource_id VARCHAR(128)
    CHECK (resource_id IS NULL OR resource_id ~ '^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$'),
  outcome VARCHAR(16) NOT NULL
    CHECK (outcome IN ('success', 'denied', 'failure')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(metadata) = 'object' AND jsonb_object_length(metadata) <= 20)
);

CREATE INDEX IF NOT EXISTS tlce_audit_records_occurred_at_idx
  ON tlce_audit_records (occurred_at DESC);
CREATE INDEX IF NOT EXISTS tlce_audit_records_actor_idx
  ON tlce_audit_records (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS tlce_audit_records_action_idx
  ON tlce_audit_records (action, occurred_at DESC);

-- Example grants for a dedicated writer role (create the role outside this migration):
-- REVOKE UPDATE, DELETE, TRUNCATE ON tlce_audit_records FROM tlce_audit_writer;
-- GRANT INSERT ON tlce_audit_records TO tlce_audit_writer;

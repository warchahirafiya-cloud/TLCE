-- PostgreSQL reference migration for the Integration Control Plane.
-- Apply only after provisioning a dedicated database/schema and reviewing role grants.
-- Application transactions MUST set app.tenant_id using trusted server-side identity.

CREATE TABLE IF NOT EXISTS integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  provider_id text NOT NULL,
  lifecycle text NOT NULL CHECK (lifecycle IN (
    'catalogued','reviewed','consent_pending','connected',
    'health_checked','enabled','disconnected','revoked'
  )),
  connection_verified boolean NOT NULL DEFAULT false,
  connected_principal_id text NOT NULL,
  secret_reference_id text,
  granted_scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (tenant_id, provider_id),
  CHECK (jsonb_typeof(granted_scopes) = 'array'),
  CHECK (lifecycle NOT IN ('connected','health_checked','enabled') OR connection_verified),
  CHECK (lifecycle <> 'revoked' OR revoked_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS integration_connections_tenant_lifecycle_idx
  ON integration_connections (tenant_id, lifecycle);

CREATE TABLE IF NOT EXISTS integration_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  principal_id text NOT NULL,
  provider_id text NOT NULL,
  resource_patterns jsonb NOT NULL,
  permissions jsonb NOT NULL,
  operations jsonb NOT NULL,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, principal_id, provider_id),
  CHECK (jsonb_typeof(resource_patterns) = 'array'),
  CHECK (jsonb_typeof(permissions) = 'array'),
  CHECK (jsonb_typeof(operations) = 'array')
);

CREATE INDEX IF NOT EXISTS integration_grants_lookup_idx
  ON integration_grants (tenant_id, principal_id, provider_id);

-- Never store raw OAuth state or plaintext PKCE verifier in this table.
-- state_hash is SHA-256 of callback state; verifier_ciphertext is KMS-encrypted.
CREATE TABLE IF NOT EXISTS integration_oauth_transactions (
  state_hash bytea PRIMARY KEY,
  tenant_id uuid NOT NULL,
  principal_id text NOT NULL,
  provider_id text NOT NULL,
  browser_session_hash bytea NOT NULL,
  code_verifier_ciphertext bytea NOT NULL,
  redirect_uri text NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (octet_length(state_hash) = 32),
  CHECK (octet_length(browser_session_hash) = 32),
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS integration_oauth_transactions_expiry_idx
  ON integration_oauth_transactions (expires_at);

CREATE TABLE IF NOT EXISTS integration_audit_events (
  event_id text PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  correlation_id text NOT NULL,
  tenant_id uuid NOT NULL,
  principal_id text NOT NULL,
  provider_id text NOT NULL,
  operation text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('allowed','denied','succeeded','failed','revoked')),
  reason text
);

CREATE INDEX IF NOT EXISTS integration_audit_tenant_time_idx
  ON integration_audit_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS integration_audit_correlation_idx
  ON integration_audit_events (correlation_id);

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_oauth_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integration_connections_tenant_policy ON integration_connections;
CREATE POLICY integration_connections_tenant_policy ON integration_connections
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS integration_grants_tenant_policy ON integration_grants;
CREATE POLICY integration_grants_tenant_policy ON integration_grants
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS integration_oauth_tenant_policy ON integration_oauth_transactions;
CREATE POLICY integration_oauth_tenant_policy ON integration_oauth_transactions
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS integration_audit_tenant_policy ON integration_audit_events;
CREATE POLICY integration_audit_tenant_policy ON integration_audit_events
  USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE UPDATE, DELETE, TRUNCATE ON integration_audit_events FROM PUBLIC;

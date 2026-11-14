import { createHash } from "node:crypto";
import type { IntegrationGrant, IntegrationLifecycle, ProviderDescriptor } from "../../core/src/contracts.js";
import type { IntegrationAuditSink } from "../../core/src/adapter.js";
import type { OAuthCallbackBinding, OAuthTransactionStore, PendingOAuthTransaction } from "../../core/src/oauth.js";
import type {
  DurableIntegrationAuditRecord,
  IntegrationConnectionRepository,
  IntegrationGrantRepository,
  IntegrationPersistence,
  PersistedIntegrationConnection,
  ProviderRegistryRepository,
} from "../../core/src/persistence.js";

export interface PgQueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly rows: readonly Row[];
  readonly rowCount?: number | null;
}
export interface PgClientLike {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<PgQueryResult<Row>>;
  release(): void;
}
export interface PgPoolLike {
  connect(): Promise<PgClientLike>;
}
export interface OAuthVerifierCipher {
  encrypt(plaintext: Uint8Array, context: { tenantId: string; providerId: string }): Promise<Uint8Array>;
  decrypt(ciphertext: Uint8Array, context: { tenantId: string; providerId: string }): Promise<Uint8Array>;
}

function requireTenantUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("A validated tenant UUID is required");
  }
  return value;
}
function millis(value: unknown): number {
  const result = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
  if (!Number.isFinite(result)) throw new Error("Invalid database timestamp");
  return result;
}
function stringArray(value: unknown): string[] {
  const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("Invalid persisted string array");
  }
  return parsed;
}
function mapConnection(row: Record<string, unknown>): PersistedIntegrationConnection {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    providerId: String(row.provider_id),
    lifecycle: String(row.lifecycle) as IntegrationLifecycle,
    connectionVerified: row.connection_verified === true,
    connectedPrincipalId: String(row.connected_principal_id),
    ...(row.secret_reference_id ? { secretReferenceId: String(row.secret_reference_id) } : {}),
    grantedScopes: stringArray(row.granted_scopes),
    createdAt: millis(row.created_at),
    updatedAt: millis(row.updated_at),
    ...(row.revoked_at ? { revokedAt: millis(row.revoked_at) } : {}),
  };
}
function mapGrant(row: Record<string, unknown>): IntegrationGrant {
  return {
    tenantId: String(row.tenant_id),
    principalId: String(row.principal_id),
    providerId: String(row.provider_id),
    resourcePatterns: stringArray(row.resource_patterns),
    permissions: stringArray(row.permissions) as IntegrationGrant["permissions"],
    operations: stringArray(row.operations),
    ...(row.expires_at ? { expiresAt: millis(row.expires_at) } : {}),
    revoked: row.revoked_at !== null && row.revoked_at !== undefined,
  };
}

async function tenantTransaction<T>(
  pool: PgPoolLike,
  tenantId: string,
  work: (client: PgClientLike) => Promise<T>,
): Promise<T> {
  const tenant = requireTenantUuid(tenantId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenant]);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* preserve original failure */ }
    throw error;
  } finally {
    client.release();
  }
}

class PgConnectionRepository implements IntegrationConnectionRepository {
  constructor(private readonly pool: PgPoolLike) {}
  get(tenantId: string, providerId: string) {
    return tenantTransaction(this.pool, tenantId, async (db) => {
      const result = await db.query(
        "SELECT * FROM integration_connections WHERE tenant_id = $1::uuid AND provider_id = $2",
        [tenantId, providerId],
      );
      return result.rows[0] ? mapConnection(result.rows[0]) : undefined;
    });
  }
  create(record: PersistedIntegrationConnection) {
    return tenantTransaction(this.pool, record.tenantId, async (db) => {
      await db.query(
        `INSERT INTO integration_connections
          (id, tenant_id, provider_id, lifecycle, connection_verified, connected_principal_id,
           secret_reference_id, granted_scopes, created_at, updated_at, revoked_at)
         VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8::jsonb,to_timestamp($9/1000.0),to_timestamp($10/1000.0),
           CASE WHEN $11::bigint IS NULL THEN NULL ELSE to_timestamp($11/1000.0) END)`,
        [record.id, record.tenantId, record.providerId, record.lifecycle, record.connectionVerified,
          record.connectedPrincipalId, record.secretReferenceId ?? null, JSON.stringify(record.grantedScopes),
          record.createdAt, record.updatedAt, record.revokedAt ?? null],
      );
    });
  }
  transition(input: {
    tenantId: string;
    providerId: string;
    expectedLifecycle: IntegrationLifecycle;
    next: PersistedIntegrationConnection;
  }) {
    if (input.next.tenantId !== input.tenantId || input.next.providerId !== input.providerId) {
      throw new Error("Connection transition identity mismatch");
    }
    return tenantTransaction(this.pool, input.tenantId, async (db) => {
      const result = await db.query(
        `UPDATE integration_connections SET lifecycle=$1, connection_verified=$2,
          connected_principal_id=$3, secret_reference_id=$4, granted_scopes=$5::jsonb,
          updated_at=to_timestamp($6/1000.0),
          revoked_at=CASE WHEN $7::bigint IS NULL THEN NULL ELSE to_timestamp($7/1000.0) END
         WHERE tenant_id=$8::uuid AND provider_id=$9 AND lifecycle=$10 RETURNING id`,
        [input.next.lifecycle, input.next.connectionVerified, input.next.connectedPrincipalId,
          input.next.secretReferenceId ?? null, JSON.stringify(input.next.grantedScopes),
          input.next.updatedAt, input.next.revokedAt ?? null, input.tenantId, input.providerId,
          input.expectedLifecycle],
      );
      return result.rows.length === 1;
    });
  }
  list(tenantId: string) {
    return tenantTransaction(this.pool, tenantId, async (db) => {
      const result = await db.query(
        "SELECT * FROM integration_connections WHERE tenant_id=$1::uuid ORDER BY created_at DESC",
        [tenantId],
      );
      return result.rows.map(mapConnection);
    });
  }
}

class PgGrantRepository implements IntegrationGrantRepository {
  constructor(private readonly pool: PgPoolLike) {}
  get(input: { tenantId: string; principalId: string; providerId: string }) {
    return tenantTransaction(this.pool, input.tenantId, async (db) => {
      const result = await db.query(
        "SELECT * FROM integration_grants WHERE tenant_id=$1::uuid AND principal_id=$2 AND provider_id=$3",
        [input.tenantId, input.principalId, input.providerId],
      );
      return result.rows[0] ? mapGrant(result.rows[0]) : undefined;
    });
  }
  put(grant: IntegrationGrant) {
    return tenantTransaction(this.pool, grant.tenantId, async (db) => {
      await db.query(
        `INSERT INTO integration_grants
          (tenant_id,principal_id,provider_id,resource_patterns,permissions,operations,expires_at,revoked_at)
         VALUES ($1::uuid,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,
          CASE WHEN $7::bigint IS NULL THEN NULL ELSE to_timestamp($7/1000.0) END,
          CASE WHEN $8::boolean THEN now() ELSE NULL END)
         ON CONFLICT (tenant_id,principal_id,provider_id) DO UPDATE SET
          resource_patterns=EXCLUDED.resource_patterns, permissions=EXCLUDED.permissions,
          operations=EXCLUDED.operations, expires_at=EXCLUDED.expires_at,
          revoked_at=EXCLUDED.revoked_at, updated_at=now()`,
        [grant.tenantId, grant.principalId, grant.providerId, JSON.stringify(grant.resourcePatterns),
          JSON.stringify(grant.permissions), JSON.stringify(grant.operations), grant.expiresAt ?? null,
          grant.revoked === true],
      );
    });
  }
  revoke(input: { tenantId: string; principalId: string; providerId: string; revokedAt: number }) {
    return tenantTransaction(this.pool, input.tenantId, async (db) => {
      await db.query(
        "UPDATE integration_grants SET revoked_at=to_timestamp($1/1000.0), updated_at=now() WHERE tenant_id=$2::uuid AND principal_id=$3 AND provider_id=$4",
        [input.revokedAt, input.tenantId, input.principalId, input.providerId],
      );
    });
  }
}

class PgOAuthTransactionStore implements OAuthTransactionStore {
  constructor(private readonly pool: PgPoolLike, private readonly cipher: OAuthVerifierCipher) {}
  put(transaction: PendingOAuthTransaction) {
    return tenantTransaction(this.pool, transaction.tenantId, async (db) => {
      const verifierCiphertext = await this.cipher.encrypt(
        Buffer.from(transaction.codeVerifier, "utf8"),
        { tenantId: transaction.tenantId, providerId: transaction.providerId },
      );
      await db.query(
        `INSERT INTO integration_oauth_transactions
          (state_hash,tenant_id,principal_id,provider_id,browser_session_hash,
           code_verifier_ciphertext,redirect_uri,created_at,expires_at)
         VALUES ($1,$2::uuid,$3,$4,$5,$6,$7,to_timestamp($8/1000.0),to_timestamp($9/1000.0))`,
        [createHash("sha256").update(transaction.state).digest(), transaction.tenantId,
          transaction.principalId, transaction.providerId,
          Buffer.from(transaction.browserSessionHash, "base64url"), Buffer.from(verifierCiphertext),
          transaction.redirectUri, transaction.createdAt, transaction.expiresAt],
      );
    });
  }
  consume(state: string, binding: OAuthCallbackBinding) {
    return tenantTransaction(this.pool, binding.tenantId, async (db) => {
      const result = await db.query(
        `DELETE FROM integration_oauth_transactions
         WHERE state_hash=$1 AND tenant_id=$2::uuid AND principal_id=$3
           AND browser_session_hash=$4 AND expires_at > now()
         RETURNING provider_id,tenant_id,principal_id,browser_session_hash,
                   code_verifier_ciphertext,redirect_uri,created_at,expires_at`,
        [createHash("sha256").update(state).digest(), binding.tenantId, binding.principalId,
          Buffer.from(binding.browserSessionHash, "base64url")],
      );
      const row = result.rows[0];
      if (!row) return undefined;
      const providerId = String(row.provider_id);
      const verifier = await this.cipher.decrypt(Buffer.from(row.code_verifier_ciphertext as Uint8Array), {
        tenantId: String(row.tenant_id),
        providerId,
      });
      return {
        state,
        providerId,
        tenantId: String(row.tenant_id),
        principalId: String(row.principal_id),
        browserSessionHash: Buffer.from(row.browser_session_hash as Uint8Array).toString("base64url"),
        codeVerifier: Buffer.from(verifier).toString("utf8"),
        redirectUri: String(row.redirect_uri),
        createdAt: millis(row.created_at),
        expiresAt: millis(row.expires_at),
      } satisfies PendingOAuthTransaction;
    });
  }
}

class PgAuditSink implements IntegrationAuditSink {
  constructor(private readonly pool: PgPoolLike) {}
  append(event: DurableIntegrationAuditRecord) {
    return tenantTransaction(this.pool, event.tenantId, async (db) => {
      await db.query(
        `INSERT INTO integration_audit_events
          (event_id,occurred_at,correlation_id,tenant_id,principal_id,provider_id,operation,outcome,reason)
         VALUES ($1,to_timestamp($2/1000.0),$3,$4::uuid,$5,$6,$7,$8,$9)`,
        [event.eventId, event.occurredAt, event.correlationId, event.tenantId,
          event.principalId, event.providerId, event.operation, event.outcome, event.reason ?? null],
      );
    });
  }
}

export function createPostgresIntegrationPersistence(input: {
  pool: PgPoolLike;
  verifierCipher: OAuthVerifierCipher;
  providers: ProviderRegistryRepository;
}): IntegrationPersistence {
  return {
    connections: new PgConnectionRepository(input.pool),
    grants: new PgGrantRepository(input.pool),
    providers: input.providers,
    oauthTransactions: new PgOAuthTransactionStore(input.pool, input.verifierCipher),
  };
}

export function createPostgresIntegrationAuditSink(pool: PgPoolLike): IntegrationAuditSink {
  return new PgAuditSink(pool);
}

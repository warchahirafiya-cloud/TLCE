import assert from "node:assert/strict";
import test from "node:test";
import type { PgClientLike, PgPoolLike, PgQueryResult, OAuthVerifierCipher } from "./adapter.js";
import {
  createPostgresIntegrationAuditSink,
  createPostgresIntegrationPersistence,
} from "./adapter.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const binding = {
  tenantId,
  principalId: "principal-1",
  browserSessionHash: "b".repeat(43),
};

class FakeClient implements PgClientLike {
  readonly calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  released = false;
  fail = false;
  nextRows: readonly Record<string, unknown>[] = [];
  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values: readonly unknown[] = [],
  ): Promise<PgQueryResult<Row>> {
    this.calls.push({ sql, values });
    if (this.fail && sql.includes("integration_connections")) throw new Error("database unavailable");
    return { rows: this.nextRows as readonly Row[], rowCount: this.nextRows.length };
  }
  release() { this.released = true; }
}
class FakePool implements PgPoolLike {
  readonly client = new FakeClient();
  connects = 0;
  async connect() { this.connects += 1; return this.client; }
}
const cipher: OAuthVerifierCipher = {
  async encrypt(value) { return Buffer.from(value); },
  async decrypt() { return Buffer.from("test-verifier"); },
};
const providers = {
  async get() { return undefined; },
  async listEnabled() { return []; },
};

test("sets trusted tenant context before any tenant-owned query", async () => {
  const pool = new FakePool();
  const persistence = createPostgresIntegrationPersistence({ pool, verifierCipher: cipher, providers });
  const result = await persistence.connections.get(tenantId, "sample-provider");
  assert.equal(result, undefined);
  assert.equal(pool.client.calls[0].sql, "BEGIN");
  assert.match(pool.client.calls[1].sql, /set_config\('app\.tenant_id'/);
  assert.deepEqual(pool.client.calls[1].values, [tenantId]);
  assert.match(pool.client.calls[2].sql, /WHERE tenant_id = \$1::uuid AND provider_id = \$2/);
  assert.equal(pool.client.calls.at(-1)?.sql, "COMMIT");
  assert.equal(pool.client.released, true);
});

test("rejects invalid tenant identifiers before opening a database connection", async () => {
  const pool = new FakePool();
  const persistence = createPostgresIntegrationPersistence({ pool, verifierCipher: cipher, providers });
  await assert.rejects(() => persistence.connections.get("not-a-uuid", "sample-provider"));
  assert.equal(pool.connects, 0);
});

test("OAuth consume binds tenant, principal, browser session and expiry in one delete", async () => {
  const pool = new FakePool();
  const persistence = createPostgresIntegrationPersistence({ pool, verifierCipher: cipher, providers });
  const state = "opaque-random-state";
  const result = await persistence.oauthTransactions.consume(state, binding);
  assert.equal(result, undefined);
  const call = pool.client.calls.find((entry) => entry.sql.includes("DELETE FROM integration_oauth_transactions"));
  assert.ok(call);
  assert.match(call.sql, /tenant_id=\$2::uuid AND principal_id=\$3/);
  assert.match(call.sql, /browser_session_hash=\$4 AND expires_at > now\(\)/);
  assert.equal((call.values[0] as Buffer).length, 32);
  assert.equal(call.values[1], tenantId);
  assert.equal(call.values[2], binding.principalId);
});

test("rolls back and releases a connection when a repository query fails", async () => {
  const pool = new FakePool();
  pool.client.fail = true;
  const persistence = createPostgresIntegrationPersistence({ pool, verifierCipher: cipher, providers });
  await assert.rejects(() => persistence.connections.get(tenantId, "sample-provider"), /database unavailable/);
  assert.equal(pool.client.calls.at(-1)?.sql, "ROLLBACK");
  assert.equal(pool.client.released, true);
});

test("audit sink writes through a tenant-scoped transaction", async () => {
  const pool = new FakePool();
  const audit = createPostgresIntegrationAuditSink(pool);
  await audit.append({
    eventId: "event-1",
    occurredAt: 1000,
    correlationId: "trace-1",
    tenantId,
    principalId: "principal-1",
    providerId: "sample-provider",
    operation: "records.read",
    outcome: "allowed",
  });
  const insert = pool.client.calls.find((entry) => entry.sql.includes("INSERT INTO integration_audit_events"));
  assert.ok(insert);
  assert.equal(insert.values[0], "event-1");
  assert.equal(pool.client.calls.at(-1)?.sql, "COMMIT");
});

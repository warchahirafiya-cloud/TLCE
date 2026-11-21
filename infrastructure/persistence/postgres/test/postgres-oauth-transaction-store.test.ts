import test from "node:test";
import assert from "node:assert/strict";
import {
  PostgresOAuthTransactionStore,
} from "../src/postgres-oauth-transaction-store.js";
import type { PostgresQueryExecutor, PostgresQueryResult } from "../src/postgres-operator-session-store.js";
import type { OAuthTransactionRecord } from "../../../../core/identity/src/oauth-transaction.js";

const record: OAuthTransactionRecord = Object.freeze({
  stateHash: "a".repeat(64),
  provider: "github",
  redirectUri: "https://console.tlce.store/auth/github/callback",
  createdAtMs: 1_800_000_000_000,
  expiresAtMs: 1_800_000_300_000,
});

class FakeDatabase implements PostgresQueryExecutor {
  calls: Array<{ text: string; values: ReadonlyArray<unknown> }> = [];
  row: Record<string, unknown> | null = null;
  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: ReadonlyArray<unknown> = [],
  ): Promise<PostgresQueryResult<Row>> {
    this.calls.push({ text, values });
    return { rows: (this.row ? [this.row] : []) as Row[], rowCount: this.row ? 1 : 0 };
  }
}

test("inserts only the state digest and fixed callback metadata", async () => {
  const db = new FakeDatabase();
  const store = new PostgresOAuthTransactionStore(db);
  await store.create(record);
  assert.match(db.calls[0].text, /INSERT INTO tlce_oauth_transactions/);
  assert.deepEqual(db.calls[0].values, [
    record.stateHash, record.provider, record.redirectUri, record.createdAtMs, record.expiresAtMs,
  ]);
});

test("atomically consumes state with DELETE RETURNING", async () => {
  const db = new FakeDatabase();
  db.row = {
    state_hash: record.stateHash,
    provider: record.provider,
    redirect_uri: record.redirectUri,
    created_at_ms: String(record.createdAtMs),
    expires_at_ms: String(record.expiresAtMs),
  };
  const store = new PostgresOAuthTransactionStore(db);
  assert.deepEqual(await store.consume(record.stateHash, record.createdAtMs + 1000), record);
  assert.match(db.calls[0].text, /DELETE FROM tlce_oauth_transactions/);
  assert.match(db.calls[0].text, /RETURNING/);
});

test("returns null for unknown or expired states", async () => {
  const db = new FakeDatabase();
  const store = new PostgresOAuthTransactionStore(db);
  assert.equal(await store.consume(record.stateHash, record.createdAtMs), null);
  db.row = {
    state_hash: record.stateHash,
    provider: record.provider,
    redirect_uri: record.redirectUri,
    created_at_ms: record.createdAtMs,
    expires_at_ms: record.expiresAtMs,
  };
  assert.equal(await store.consume(record.stateHash, record.expiresAtMs), null);
});

test("rejects malformed records before insert", async () => {
  const db = new FakeDatabase();
  const store = new PostgresOAuthTransactionStore(db);
  await assert.rejects(store.create({ ...record, stateHash: "raw-state" }), /Invalid OAuth transaction/);
  await assert.rejects(store.create({ ...record, redirectUri: "http://insecure.example/callback" }), /Invalid OAuth transaction/);
  assert.equal(db.calls.length, 0);
});

test("rejects malformed persisted transaction rows", async () => {
  const db = new FakeDatabase();
  db.row = {
    state_hash: record.stateHash,
    provider: "google",
    redirect_uri: record.redirectUri,
    created_at_ms: record.createdAtMs,
    expires_at_ms: record.expiresAtMs,
  };
  const store = new PostgresOAuthTransactionStore(db);
  await assert.rejects(store.consume(record.stateHash, record.createdAtMs), /Invalid persisted/);
});

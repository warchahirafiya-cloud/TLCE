import test from "node:test";
import assert from "node:assert/strict";
import {
  PostgresOperatorSessionStore,
  type PostgresQueryExecutor,
  type PostgresQueryResult,
} from "../src/postgres-operator-session-store.js";
import type { OperatorSessionRecord } from "../../../core/identity/src/operator-session.js";

const sample: OperatorSessionRecord = Object.freeze({
  sessionTokenHash: "a".repeat(64),
  subject: "operator-42",
  roles: Object.freeze(["viewer", "operator"]),
  allowedModuleIds: Object.freeze(["store", "questpulse"]),
  csrfTokenHash: "b".repeat(64),
  createdAtMs: 1_800_000_000_000,
  lastSeenAtMs: 1_800_000_001_000,
  idleExpiresAtMs: 1_800_001_000_000,
  absoluteExpiresAtMs: 1_800_002_000_000,
});

class FakePostgres implements PostgresQueryExecutor {
  readonly calls: Array<{ text: string; values: ReadonlyArray<unknown> }> = [];
  row: Record<string, unknown> | null = null;
  affected = 1;

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: ReadonlyArray<unknown> = [],
  ): Promise<PostgresQueryResult<Row>> {
    this.calls.push({ text, values });
    if (text.includes("SELECT session_token_hash")) {
      return { rows: (this.row ? [this.row] : []) as Row[], rowCount: this.row ? 1 : 0 };
    }
    return { rows: [], rowCount: this.affected };
  }
}

function rowFrom(record: OperatorSessionRecord): Record<string, unknown> {
  return {
    session_token_hash: record.sessionTokenHash,
    subject: record.subject,
    roles: [...record.roles],
    allowed_module_ids: [...record.allowedModuleIds],
    csrf_token_hash: record.csrfTokenHash,
    created_at_ms: String(record.createdAtMs),
    last_seen_at_ms: String(record.lastSeenAtMs),
    idle_expires_at_ms: String(record.idleExpiresAtMs),
    absolute_expires_at_ms: String(record.absoluteExpiresAtMs),
  };
}

test("creates records using parameterized SQL and stores only digests", async () => {
  const db = new FakePostgres();
  const store = new PostgresOperatorSessionStore(db);
  await store.create(sample);
  assert.match(db.calls[0].text, /INSERT INTO tlce_operator_sessions/);
  assert.equal(db.calls[0].values[0], sample.sessionTokenHash);
  assert.equal(db.calls[0].values.includes("raw-session-token"), false);
  assert.equal(db.calls[0].values[2], JSON.stringify(sample.roles));
});

test("loads and validates a session record from PostgreSQL rows", async () => {
  const db = new FakePostgres();
  db.row = rowFrom(sample);
  const store = new PostgresOperatorSessionStore(db);
  const found = await store.find(sample.sessionTokenHash);
  assert.deepEqual(found, sample);
  assert.equal(await store.find("not-a-digest"), null);
  assert.match(db.calls[0].text, /WHERE session_token_hash = \$1/);
});

test("replaces a record and rejects updates for missing sessions", async () => {
  const db = new FakePostgres();
  const store = new PostgresOperatorSessionStore(db);
  await store.replace(sample);
  assert.match(db.calls[0].text, /UPDATE tlce_operator_sessions/);
  db.affected = 0;
  await assert.rejects(store.replace(sample), /does not exist/);
});

test("deletes only valid SHA-256 digests", async () => {
  const db = new FakePostgres();
  const store = new PostgresOperatorSessionStore(db);
  await store.delete("invalid");
  assert.equal(db.calls.length, 0);
  await store.delete(sample.sessionTokenHash);
  assert.match(db.calls[0].text, /DELETE FROM tlce_operator_sessions/);
});

test("cleans expired sessions in bounded, lock-safe batches", async () => {
  const db = new FakePostgres();
  db.affected = 7;
  const store = new PostgresOperatorSessionStore(db);
  assert.equal(await store.deleteExpired(1_800_000_000_000, 100), 7);
  assert.match(db.calls[0].text, /FOR UPDATE SKIP LOCKED/);
  assert.deepEqual(db.calls[0].values, [1_800_000_000_000, 100]);
  await assert.rejects(store.deleteExpired(-1), /parameters/);
  await assert.rejects(store.deleteExpired(100, 0), /parameters/);
});

test("rejects malformed persisted roles and session lifetimes", async () => {
  const db = new FakePostgres();
  db.row = { ...rowFrom(sample), roles: ["root"] };
  const store = new PostgresOperatorSessionStore(db);
  await assert.rejects(store.find(sample.sessionTokenHash), /roles/);
  db.row = { ...rowFrom(sample), idle_expires_at_ms: "1900000000000" };
  await assert.rejects(store.find(sample.sessionTokenHash), /lifetime/);
});

test("rejects malformed records before reaching the database", async () => {
  const db = new FakePostgres();
  const store = new PostgresOperatorSessionStore(db);
  await assert.rejects(store.create({ ...sample, subject: "bad subject!" }), /record/);
  await assert.rejects(store.create({ ...sample, csrfTokenHash: "plaintext" }), /digest/);
  assert.equal(db.calls.length, 0);
});

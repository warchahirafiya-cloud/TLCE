import test from "node:test";
import assert from "node:assert/strict";
import { PostgresEventStore, type SqlExecutor, type SqlQueryResult } from "../runtime/postgres-event-store.js";
import type { TlceEvent } from "../contracts/events.js";

class FakeSql implements SqlExecutor {
  readonly calls: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  readonly responses: Array<{ rows: Array<Record<string, unknown>>; rowCount: number | null }> = [];
  async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, parameters: readonly unknown[] = [],
  ): Promise<SqlQueryResult<TRow>> {
    this.calls.push({ sql, parameters });
    const response = this.responses.shift() ?? { rows: [], rowCount: 1 };
    return { rows: response.rows as TRow[], rowCount: response.rowCount };
  }
}

const event: TlceEvent<{ taskId: string }> = {
  eventId: "evt-42", eventType: "questpulse.task.requested", schemaVersion: 1,
  occurredAt: "2026-11-14T10:00:00.000Z", producerModule: "tlce-ai-core-bridge",
  idempotencyKey: "delivery-42", payload: { taskId: "task-42" },
};

test("claims an event atomically using a database lease and unique key", async () => {
  const sql = new FakeSql();
  sql.responses.push({ rows: [{ dedupe_key: "key-1" }], rowCount: 1 });
  const store = new PostgresEventStore(sql, { leaseDurationMs: 5_000 });
  assert.equal(await store.claim("key-1"), "claimed");
  assert.match(sql.calls[0].sql, /ON CONFLICT \(dedupe_key\) DO UPDATE/);
  assert.match(sql.calls[0].sql, /lease_until <= CURRENT_TIMESTAMP/);
  assert.deepEqual(sql.calls[0].parameters, ["key-1", 5_000]);
});

test("distinguishes completed and currently leased duplicate deliveries", async () => {
  const sql = new FakeSql();
  const store = new PostgresEventStore(sql);
  sql.responses.push(
    { rows: [], rowCount: 0 }, { rows: [{ status: "completed" }], rowCount: 1 },
    { rows: [], rowCount: 0 }, { rows: [{ status: "in_progress" }], rowCount: 1 },
  );
  assert.equal(await store.claim("done"), "completed");
  assert.equal(await store.claim("busy"), "in_progress");
});

test("fails closed if the durable state cannot be determined", async () => {
  const sql = new FakeSql();
  sql.responses.push({ rows: [], rowCount: 0 }, { rows: [], rowCount: 0 });
  const store = new PostgresEventStore(sql);
  await assert.rejects(() => store.claim("race"), /Unable to determine/);
});

test("marks completion and releases failed claims with guarded updates", async () => {
  const sql = new FakeSql();
  const store = new PostgresEventStore(sql);
  await store.markCompleted("key");
  assert.match(sql.calls[0].sql, /status = 'completed'/);
  await store.release("key");
  assert.match(sql.calls[1].sql, /status = 'failed'/);
});

test("does not silently accept a missing active claim", async () => {
  const sql = new FakeSql();
  sql.responses.push({ rows: [], rowCount: 0 }, { rows: [], rowCount: 0 });
  const store = new PostgresEventStore(sql);
  await assert.rejects(() => store.markCompleted("missing"), /active durable claim/);
  await assert.rejects(() => store.release("missing"), /active durable claim/);
});

test("persists dead letters with bounded failure metadata and idempotent event ID", async () => {
  const sql = new FakeSql();
  const store = new PostgresEventStore(sql);
  await store.record(event, {
    attempts: 3, reason: "x".repeat(700), failedAt: "2026-11-14T10:05:00.000Z",
  });
  assert.match(sql.calls[0].sql, /ON CONFLICT \(event_id\) DO UPDATE/);
  const failure = JSON.parse(String(sql.calls[0].parameters[4]));
  assert.equal(failure.reason.length, 500);
});

test("rejects unsafe configuration and malformed claims", async () => {
  const sql = new FakeSql();
  assert.throws(() => new PostgresEventStore(sql, { leaseDurationMs: 10 }), /leaseDurationMs/);
  const store = new PostgresEventStore(sql);
  await assert.rejects(() => store.claim(" "), /Invalid event deduplication key/);
});

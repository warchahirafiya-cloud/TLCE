import test from "node:test";
import assert from "node:assert/strict";
import { PostgresEventOutbox } from "../runtime/postgres-event-outbox.js";
import type { SqlExecutor, SqlQueryResult } from "../runtime/postgres-event-store.js";
import type { TlceEvent } from "../contracts/events.js";

class FakeSql implements SqlExecutor {
  readonly calls: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  responses: Array<{ rows: Array<Record<string, unknown>>; rowCount: number | null }> = [];
  async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, parameters: readonly unknown[] = [],
  ): Promise<SqlQueryResult<TRow>> {
    this.calls.push({ sql, parameters });
    const response = this.responses.shift() ?? { rows: [], rowCount: 1 };
    return { rows: response.rows as TRow[], rowCount: response.rowCount };
  }
}

const event: TlceEvent<{ taskId: string }> = {
  eventId: "evt-outbox-1", eventType: "questpulse.task.requested", schemaVersion: 1,
  occurredAt: "2026-11-14T10:00:00.000Z", producerModule: "tlce-ai-core-bridge",
  idempotencyKey: "delivery-1", payload: { taskId: "task-1" },
};

test("writes validated events idempotently to the transactional outbox", async () => {
  const sql = new FakeSql();
  const outbox = new PostgresEventOutbox(sql);
  await outbox.publish(event, { partitionKey: "questpulse" });
  assert.match(sql.calls[0].sql, /ON CONFLICT \(event_id\) DO NOTHING/);
  assert.equal(sql.calls[0].parameters[3], "questpulse");
});

test("claims a bounded batch with row locks and expiring worker leases", async () => {
  const sql = new FakeSql();
  sql.responses.push({ rows: [{
    event_id: event.eventId, event_type: event.eventType, producer_module: event.producerModule,
    event_data: event, attempts: 1,
  }], rowCount: 1 });
  const outbox = new PostgresEventOutbox(sql, { maxBatchSize: 10, leaseDurationMs: 5_000 });
  const batch = await outbox.claimBatch("worker-1", 5);
  assert.equal(batch.length, 1);
  assert.equal(batch[0].leaseOwner, "worker-1");
  assert.match(sql.calls[0].sql, /FOR UPDATE SKIP LOCKED/);
});

test("renews only a live lease owned by the requesting worker", async () => {
  const sql = new FakeSql();
  sql.responses.push({ rows: [], rowCount: 1 }, { rows: [], rowCount: 0 });
  const outbox = new PostgresEventOutbox(sql);
  assert.equal(await outbox.renewLease("evt-1", "worker-1"), true);
  assert.equal(await outbox.renewLease("evt-1", "other-worker"), false);
  assert.match(sql.calls[0].sql, /lease_until = CURRENT_TIMESTAMP/);
  assert.match(sql.calls[0].sql, /lease_owner = \$2/);
});

test("acknowledges and releases only events owned by the worker lease", async () => {
  const sql = new FakeSql();
  const outbox = new PostgresEventOutbox(sql);
  await outbox.markPublished("evt-1", "worker-1");
  assert.match(sql.calls[0].sql, /lease_owner = \$2/);
  await outbox.release("evt-1", "worker-1", "broker unavailable", 2_000);
  assert.match(sql.calls[1].sql, /available_at = CURRENT_TIMESTAMP/);
  assert.equal(sql.calls[1].parameters[3], "broker unavailable");
});

test("fails closed on lost leases and invalid events", async () => {
  const sql = new FakeSql();
  sql.responses.push({ rows: [], rowCount: 0 }, { rows: [], rowCount: 0 });
  const outbox = new PostgresEventOutbox(sql);
  await assert.rejects(() => outbox.markPublished("evt", "other-worker"), /does not own|lost its lease/);
  await assert.rejects(() => outbox.release("evt", "other-worker", "error"), /does not own/);
  await assert.rejects(() => outbox.publish({ ...event, eventId: "bad id" }), /Invalid TLCE outbox event/);
});

test("validates worker identity, batch size and retry delay", async () => {
  const sql = new FakeSql();
  const outbox = new PostgresEventOutbox(sql, { maxBatchSize: 5 });
  await assert.rejects(() => outbox.claimBatch("bad worker id"), /Invalid outbox worker ID/);
  await assert.rejects(() => outbox.claimBatch("worker", 6), /Invalid outbox batch limit/);
  await assert.rejects(() => outbox.release("evt", "worker", "error", -1), /Invalid outbox retry delay/);
});

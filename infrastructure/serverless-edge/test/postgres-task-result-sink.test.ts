import test from "node:test";
import assert from "node:assert/strict";
import { PostgresQuestPulseTaskResultSink } from "../runtime/postgres-task-result-sink.js";
import type { SqlExecutor, SqlQueryResult } from "../runtime/postgres-event-store.js";

class FakeSql implements SqlExecutor {
  calls: Array<{ sql: string; parameters: readonly unknown[] }> = [];
  async query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string, parameters: readonly unknown[] = [],
  ): Promise<SqlQueryResult<TRow>> {
    this.calls.push({ sql, parameters });
    return { rows: [], rowCount: 1 };
  }
}

test("stores a bounded task result idempotently by task ID", async () => {
  const sql = new FakeSql();
  const sink = new PostgresQuestPulseTaskResultSink(sql);
  await sink.save("task-1", { output: "done" });
  assert.match(sql.calls[0].sql, /ON CONFLICT \(task_id\) DO NOTHING/);
  assert.equal(sql.calls[0].parameters[0], "task-1");
  assert.equal(sql.calls[0].parameters[1], JSON.stringify({ output: "done" }));
});

test("rejects invalid IDs, non-object values and oversized results", async () => {
  const sql = new FakeSql();
  const sink = new PostgresQuestPulseTaskResultSink(sql, { maxResultBytes: 128 });
  await assert.rejects(() => sink.save("bad id", {}), /Invalid QuestPulse task ID/);
  await assert.rejects(() => sink.save("task-2", "scalar" as never), /JSON object/);
  await assert.rejects(() => sink.save("task-3", { data: "x".repeat(256) }), /exceeds/);
  assert.equal(sql.calls.length, 0);
});

test("rejects non-serializable results", async () => {
  const sql = new FakeSql();
  const sink = new PostgresQuestPulseTaskResultSink(sql);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  await assert.rejects(() => sink.save("task-4", cyclic), /JSON-serializable/);
  assert.equal(sql.calls.length, 0);
});

test("validates sink configuration", () => {
  const sql = new FakeSql();
  assert.throws(() => new PostgresQuestPulseTaskResultSink(sql, { maxResultBytes: 1 }), /size limit/);
});

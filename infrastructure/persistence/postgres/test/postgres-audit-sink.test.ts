import test from "node:test";
import assert from "node:assert/strict";
import { PostgresAuditSink, type PostgresAuditQueryExecutor } from "../src/postgres-audit-sink.js";
import type { AuditRecord } from "../../../../core/audit/src/audit.js";

const record: AuditRecord = Object.freeze({
  auditId: "audit-100",
  occurredAt: "2026-11-21T10:00:00.000Z",
  requestId: "request-100",
  actorId: "operator-100",
  actorType: "user",
  moduleId: "tlce-control-plane",
  action: "console.control-plane.overview.read",
  resourceType: "control-plane",
  outcome: "success",
  metadata: Object.freeze({ resource: "control-plane.overview", action: "read" }),
});

class FakeAuditDatabase implements PostgresAuditQueryExecutor {
  calls: Array<{ text: string; values: ReadonlyArray<unknown> }> = [];
  failure: Error | null = null;
  async query(text: string, values: ReadonlyArray<unknown> = []) {
    this.calls.push({ text, values });
    if (this.failure) throw this.failure;
    return { rows: [], rowCount: 1 };
  }
}

test("writes audit events using parameterized SQL", async () => {
  const database = new FakeAuditDatabase();
  const sink = new PostgresAuditSink(database);
  await sink.write(record);
  assert.match(database.calls[0].text, /INSERT INTO tlce_audit_records/);
  assert.equal(database.calls[0].values[0], record.auditId);
  assert.equal(database.calls[0].values[3], record.actorId);
  assert.equal(database.calls[0].values[10], JSON.stringify(record.metadata));
});

test("preserves optional resource identifiers as SQL null", async () => {
  const database = new FakeAuditDatabase();
  const sink = new PostgresAuditSink(database);
  const { resourceId: _resourceId, ...withoutResourceId } = record;
  await sink.write(withoutResourceId);
  assert.equal(database.calls[0].values[8], null);
});

test("rejects unsafe audit records before database access", async () => {
  const database = new FakeAuditDatabase();
  const sink = new PostgresAuditSink(database);
  await assert.rejects(
    sink.write({ ...record, metadata: { access_token: "must-not-be-written" } }),
    /prohibited/,
  );
  assert.equal(database.calls.length, 0);
});

test("propagates database failures so callers can fail closed", async () => {
  const database = new FakeAuditDatabase();
  database.failure = new Error("audit database unavailable");
  const sink = new PostgresAuditSink(database);
  await assert.rejects(sink.write(record), /audit database unavailable/);
  assert.equal(database.calls.length, 1);
});

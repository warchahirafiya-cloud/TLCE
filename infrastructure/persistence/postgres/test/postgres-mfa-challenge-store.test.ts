import test from "node:test";
import assert from "node:assert/strict";
import { PostgresMfaChallengeStore } from "../src/postgres-mfa-challenge-store.js";
import type { PostgresQueryExecutor, PostgresQueryResult } from "../src/postgres-operator-session-store.js";

class FakeDatabase implements PostgresQueryExecutor {
  calls: Array<{ text: string; values: ReadonlyArray<unknown> }> = [];
  nextRows: Array<Record<string, unknown>> = [];
  rowCount: number | null = 1;
  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string, values: ReadonlyArray<unknown> = [],
  ): Promise<PostgresQueryResult<Row>> {
    this.calls.push({ text, values });
    return { rows: this.nextRows as Row[], rowCount: this.rowCount };
  }
}
const record = {
  challengeTokenHash: "a".repeat(64),
  subject: "tlce-operator-01",
  roles: ["maintainer"] as const,
  allowedModuleIds: ["store"] as const,
  createdAtMs: 1_800_000_000_000,
  expiresAtMs: 1_800_000_300_000,
  attempts: 0,
};

test("persists only the challenge hash using parameterized SQL", async () => {
  const db = new FakeDatabase();
  await new PostgresMfaChallengeStore(db).create(record);
  assert.match(db.calls[0].text, /INSERT INTO tlce_mfa_challenges/);
  assert.equal(db.calls[0].values[0], record.challengeTokenHash);
  assert.equal(db.calls[0].values.includes("raw-token"), false);
});

test("reserves an attempt atomically and maps the persisted challenge", async () => {
  const db = new FakeDatabase();
  db.nextRows = [{
    challenge_token_hash: record.challengeTokenHash,
    subject: record.subject,
    roles: JSON.stringify(record.roles),
    allowed_module_ids: JSON.stringify(record.allowedModuleIds),
    created_at_ms: String(record.createdAtMs),
    expires_at_ms: String(record.expiresAtMs),
    attempts: 1,
  }];
  const result = await new PostgresMfaChallengeStore(db).reserveAttempt(record.challengeTokenHash, record.createdAtMs, 5);
  assert.match(db.calls[0].text, /attempts = attempts \+ 1/);
  assert.match(db.calls[0].text, /attempts < \$3/);
  assert.equal(result?.attempts, 1);
  assert.equal(result?.subject, record.subject);
});

test("consumes exactly one challenge and supports bounded expiry cleanup", async () => {
  const db = new FakeDatabase();
  const store = new PostgresMfaChallengeStore(db);
  assert.equal(await store.consume(record.challengeTokenHash), true);
  assert.match(db.calls[0].text, /DELETE FROM tlce_mfa_challenges/);
  assert.equal(await store.deleteExpired(record.expiresAtMs + 1, 50), 1);
  assert.match(db.calls[1].text, /FOR UPDATE SKIP LOCKED/);
  assert.deepEqual(db.calls[1].values, [record.expiresAtMs + 1, 50]);
});

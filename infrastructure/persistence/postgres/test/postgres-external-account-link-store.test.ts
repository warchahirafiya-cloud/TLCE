import test from "node:test";
import assert from "node:assert/strict";
import {
  PostgresExternalAccountLinkStore,
} from "../src/postgres-external-account-link-store.js";
import type { PostgresQueryExecutor, PostgresQueryResult } from "../src/postgres-operator-session-store.js";

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

test("looks up an existing GitHub account link using parameterized SQL", async () => {
  const db = new FakeDatabase();
  db.row = { tlce_subject: "tlce-operator-01", active: true };
  const store = new PostgresExternalAccountLinkStore(db);
  const link = await store.findLink("github", "334682116");
  assert.deepEqual(link, { tlceSubject: "tlce-operator-01", active: true });
  assert.match(db.calls[0].text, /WHERE provider = \$1 AND provider_subject = \$2/);
  assert.deepEqual(db.calls[0].values, ["github", "334682116"]);
});

test("returns null for unknown external accounts", async () => {
  const db = new FakeDatabase();
  const store = new PostgresExternalAccountLinkStore(db);
  assert.equal(await store.findLink("github", "334682116"), null);
});

test("rejects unsupported providers and malformed provider subjects before querying", async () => {
  const db = new FakeDatabase();
  const store = new PostgresExternalAccountLinkStore(db);
  assert.equal(await store.findLink("other" as never, "334682116"), null);
  assert.equal(await store.findLink("github", "username"), null);
  assert.equal(db.calls.length, 0);
});

test("validates persisted TLCE subject and active flag", async () => {
  const db = new FakeDatabase();
  const store = new PostgresExternalAccountLinkStore(db);
  db.row = { tlce_subject: " invalid subject ", active: true };
  await assert.rejects(store.findLink("github", "334682116"), /Invalid persisted/);
  db.row = { tlce_subject: "tlce-operator-01", active: "true" };
  await assert.rejects(store.findLink("github", "334682116"), /Invalid persisted/);
});

test("returns disabled links without silently treating them as active", async () => {
  const db = new FakeDatabase();
  db.row = { tlce_subject: "tlce-operator-01", active: false };
  const store = new PostgresExternalAccountLinkStore(db);
  assert.deepEqual(await store.findLink("github", "334682116"), {
    tlceSubject: "tlce-operator-01",
    active: false,
  });
});

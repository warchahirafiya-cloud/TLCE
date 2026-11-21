import test from "node:test";
import assert from "node:assert/strict";
import {
  clearOperatorSessionCookie,
  createOperatorSessionCookie,
  OperatorSessionService,
  type OperatorSessionRecord,
  type OperatorSessionStore,
} from "../src/operator-session";

class MemorySessionStore implements OperatorSessionStore {
  readonly records = new Map<string, OperatorSessionRecord>();
  async create(record: OperatorSessionRecord): Promise<void> {
    if (this.records.has(record.sessionTokenHash)) throw new Error("Duplicate session");
    this.records.set(record.sessionTokenHash, record);
  }
  async find(hash: string): Promise<OperatorSessionRecord | null> {
    return this.records.get(hash) ?? null;
  }
  async replace(record: OperatorSessionRecord): Promise<void> {
    if (!this.records.has(record.sessionTokenHash)) throw new Error("Session not found");
    this.records.set(record.sessionTokenHash, record);
  }
  async delete(hash: string): Promise<void> {
    this.records.delete(hash);
  }
}

function fixture() {
  const store = new MemorySessionStore();
  let now = 1_800_000_000_000;
  let tokenIndex = 0;
  const tokens = ["s", "c", "n", "d", "e"].map((character) => character.repeat(43));
  const service = new OperatorSessionService({
    store,
    now: () => now,
    randomToken: () => tokens[tokenIndex++],
    absoluteTtlMs: 10 * 60_000,
    idleTtlMs: 2 * 60_000,
  });
  return { store, service, advance: (ms: number) => { now += ms; } };
}

const operator = {
  subject: "tlce-operator-001",
  roles: ["viewer", "operator"] as const,
  allowedModuleIds: ["questpulse", "store"] as const,
};

test("creates an opaque session and persists only token digests", async () => {
  const { store, service } = fixture();
  const created = await service.createSession(operator);
  assert.match(created.sessionToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(created.csrfToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(created.cookie, /^__Host-tlce_session=/);
  assert.equal(created.cookie.includes(created.sessionToken), true);
  const [record] = [...store.records.values()];
  assert.equal(record.sessionTokenHash.includes(created.sessionToken), false);
  assert.equal(record.csrfTokenHash.includes(created.csrfToken), false);
  assert.equal(record.subject, operator.subject);
});

test("resolves only server-stored roles and explicit module scope", async () => {
  const { service } = fixture();
  await service.createSession(operator);
  const resolved = await service.resolveSession("s".repeat(43));
  assert.deepEqual(resolved, operator);
  assert.equal(Object.isFrozen(resolved?.roles), true);
  assert.equal(await service.resolveSession("x".repeat(43)), null);
});

test("rotates and validates CSRF tokens with constant-time digest comparison", async () => {
  const { service } = fixture();
  await service.createSession(operator);
  assert.equal(await service.validateCsrfToken("s".repeat(43), "c".repeat(43)), true);
  const rotated = await service.issueCsrfToken("s".repeat(43));
  assert.equal(rotated, "n".repeat(43));
  assert.equal(await service.validateCsrfToken("s".repeat(43), "c".repeat(43)), false);
  assert.equal(await service.validateCsrfToken("s".repeat(43), rotated!), true);
  assert.equal(await service.validateCsrfToken("s".repeat(43), "invalid"), false);
});

test("expires idle sessions and deletes their server-side records", async () => {
  const { store, service, advance } = fixture();
  await service.createSession(operator);
  advance(2 * 60_000);
  assert.equal(await service.resolveSession("s".repeat(43)), null);
  assert.equal(store.records.size, 0);
});

test("activity extends idle expiry but never absolute expiry", async () => {
  const { store, service, advance } = fixture();
  await service.createSession(operator);
  advance(90_000);
  assert.notEqual(await service.resolveSession("s".repeat(43)), null);
  advance(90_000);
  assert.notEqual(await service.resolveSession("s".repeat(43)), null);
  advance(8 * 60_000);
  assert.equal(await service.resolveSession("s".repeat(43)), null);
  assert.equal(store.records.size, 0);
});

test("revokes a session and makes subsequent resolution fail", async () => {
  const { store, service } = fixture();
  await service.createSession(operator);
  await service.revokeSession("s".repeat(43));
  assert.equal(await service.resolveSession("s".repeat(43)), null);
  assert.equal(store.records.size, 0);
});

test("rejects malformed operator identities, roles, and module scopes", async () => {
  const { service } = fixture();
  await assert.rejects(service.createSession({ ...operator, subject: " invalid " }), /subject/);
  await assert.rejects(service.createSession({ ...operator, roles: [] }), /roles/);
  await assert.rejects(service.createSession({ ...operator, roles: ["root" as never] }), /roles/);
  await assert.rejects(service.createSession({ ...operator, allowedModuleIds: ["../outside"] }), /scope/);
});

test("session cookies are host-only, secure, HttpOnly and SameSite=Lax", () => {
  const cookie = createOperatorSessionCookie("s".repeat(43), 3600);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.doesNotMatch(cookie, /Domain=/);
  assert.match(clearOperatorSessionCookie(), /Max-Age=0/);
});

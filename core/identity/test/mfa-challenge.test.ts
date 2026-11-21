import test from "node:test";
import assert from "node:assert/strict";
import { MfaChallengeService, type MfaChallengeRecord, type MfaChallengeStore } from "../src/mfa-challenge.js";
import { OperatorSessionService, type OperatorSessionRecord, type OperatorSessionStore } from "../src/operator-session.js";

class MemoryChallengeStore implements MfaChallengeStore {
  readonly records = new Map<string, MfaChallengeRecord>();
  async create(record: MfaChallengeRecord) { this.records.set(record.challengeTokenHash, record); }
  async reserveAttempt(hash: string, now: number, max: number) {
    const record = this.records.get(hash);
    if (!record || record.expiresAtMs <= now || record.attempts >= max) return null;
    const updated = Object.freeze({ ...record, attempts: record.attempts + 1 });
    this.records.set(hash, updated);
    return updated;
  }
  async consume(hash: string) { return this.records.delete(hash); }
}
class MemorySessionStore implements OperatorSessionStore {
  readonly records = new Map<string, OperatorSessionRecord>();
  async create(record: OperatorSessionRecord) { this.records.set(record.sessionTokenHash, record); }
  async find(hash: string) { return this.records.get(hash) ?? null; }
  async replace(record: OperatorSessionRecord) { this.records.set(record.sessionTokenHash, record); }
  async delete(hash: string) { this.records.delete(hash); }
}
function fixture(verify: (subject: string, code: string) => Promise<boolean> = async (_s, c) => c === "123456") {
  const challengeStore = new MemoryChallengeStore();
  const sessionStore = new MemorySessionStore();
  let tokenIndex = 0;
  const tokens = ["m", "s", "c"].map((x) => x.repeat(43));
  const sessions = new OperatorSessionService({
    store: sessionStore,
    now: () => 1_800_000_000_000,
    randomToken: () => tokens[tokenIndex++],
  });
  const service = new MfaChallengeService({
    store: challengeStore,
    sessions,
    verifier: { async verify({ subject, code }) { return verify(subject, code); } },
    now: () => 1_800_000_000_000,
    randomToken: () => "m".repeat(43),
    ttlMs: 60_000,
    maxAttempts: 2,
  });
  return { service, challengeStore, sessionStore };
}
const identity = {
  subject: "tlce-operator-01",
  roles: ["maintainer"] as const,
  allowedModuleIds: ["store"] as const,
};

test("stores only a challenge digest and snapshots server-derived authorization", async () => {
  const { service, challengeStore } = fixture();
  const started = await service.begin(identity);
  assert.equal(started.challengeToken, "m".repeat(43));
  const [record] = [...challengeStore.records.values()];
  assert.equal(record.challengeTokenHash.includes(started.challengeToken), false);
  assert.equal(record.subject, identity.subject);
  assert.deepEqual(record.roles, identity.roles);
  assert.deepEqual(record.allowedModuleIds, identity.allowedModuleIds);
  assert.equal(record.attempts, 0);
});

test("creates a session only after successful TOTP verification and consumes the challenge", async () => {
  const { service, challengeStore, sessionStore } = fixture();
  const started = await service.begin(identity);
  const result = await service.complete(started.challengeToken, "123456");
  assert.match(result.session.cookie, /^__Host-tlce_session=/);
  assert.equal(result.mfaVerifiedAt, "2027-01-15T08:00:00.000Z");
  assert.equal(sessionStore.records.size, 1);
  assert.equal(challengeStore.records.size, 0);
});

test("does not create a session for an invalid factor and bounds attempts", async () => {
  const { service, sessionStore, challengeStore } = fixture(async () => false);
  const started = await service.begin(identity);
  await assert.rejects(service.complete(started.challengeToken, "000000"), /invalid or expired/);
  await assert.rejects(service.complete(started.challengeToken, "000000"), /invalid or expired/);
  await assert.rejects(service.complete(started.challengeToken, "000000"), /invalid or expired/);
  assert.equal(sessionStore.records.size, 0);
  assert.equal(challengeStore.records.size, 1);
});

test("rejects malformed tokens, non-six-digit codes and invalid policies", async () => {
  const { service } = fixture();
  await assert.rejects(service.begin({ ...identity, roles: [] }), /policy/);
  await assert.rejects(service.complete("bad", "123456"), /invalid or expired/);
  const started = await service.begin(identity);
  await assert.rejects(service.complete(started.challengeToken, "12345"), /invalid or expired/);
});

test("a challenge cannot be completed twice", async () => {
  const { service, sessionStore } = fixture();
  const started = await service.begin(identity);
  await service.complete(started.challengeToken, "123456");
  await assert.rejects(service.complete(started.challengeToken, "123456"), /invalid or expired/);
  assert.equal(sessionStore.records.size, 1);
});

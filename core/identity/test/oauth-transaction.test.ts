import test from "node:test";
import assert from "node:assert/strict";
import {
  OAuthTransactionService,
  type OAuthTransactionRecord,
  type OAuthTransactionStore,
} from "../src/oauth-transaction.js";

class MemoryOAuthStore implements OAuthTransactionStore {
  records = new Map<string, OAuthTransactionRecord>();
  async create(record: OAuthTransactionRecord) { this.records.set(record.stateHash, record); }
  async consume(hash: string, now: number) {
    const record = this.records.get(hash);
    if (!record) return null;
    this.records.delete(hash);
    return record.expiresAtMs > now ? record : null;
  }
}

function fixture() {
  const store = new MemoryOAuthStore();
  let now = 1_800_000_000_000;
  const service = new OAuthTransactionService({
    store,
    now: () => now,
    randomState: () => "s".repeat(43),
    ttlMs: 60_000,
  });
  return { store, service, advance: (ms: number) => { now += ms; } };
}

const redirect = "https://console.tlce.store/auth/github/callback";

test("creates a high-entropy state and stores only its digest", async () => {
  const { store, service } = fixture();
  const transaction = await service.create("github", redirect);
  assert.match(transaction.state, /^[A-Za-z0-9_-]{43}$/);
  const [record] = [...store.records.values()];
  assert.equal(record.stateHash.includes(transaction.state), false);
  assert.equal(record.redirectUri, redirect);
});

test("consumes state once and rejects replay", async () => {
  const { service } = fixture();
  const transaction = await service.create("github", redirect);
  assert.deepEqual(await service.consume("github", transaction.state, redirect), { redirectUri: redirect });
  await assert.rejects(service.consume("github", transaction.state, redirect), /invalid, expired/);
});

test("rejects unknown, expired and mismatched callback state", async () => {
  const { service, advance } = fixture();
  await assert.rejects(service.consume("github", "x".repeat(43), redirect), /invalid, expired/);
  const expired = await service.create("github", redirect);
  advance(60_000);
  await assert.rejects(service.consume("github", expired.state, redirect), /invalid, expired/);
});

test("consumes but rejects a transaction with a mismatched callback URI", async () => {
  const { service } = fixture();
  const transaction = await service.create("github", redirect);
  await assert.rejects(
    service.consume("github", transaction.state, "https://attacker.example/callback"),
    /invalid, expired/,
  );
  await assert.rejects(service.consume("github", transaction.state, redirect), /invalid, expired/);
});

test("rejects non-HTTPS, credential-bearing and fragment redirect URIs", async () => {
  const { service } = fixture();
  await assert.rejects(service.create("github", "http://console.tlce.store/callback"), /HTTPS/);
  await assert.rejects(service.create("github", "https://user:pass@console.tlce.store/callback"), /HTTPS/);
  await assert.rejects(service.create("github", "https://console.tlce.store/callback#fragment"), /HTTPS/);
});

test("rejects unsupported providers and malformed state tokens", async () => {
  const { service } = fixture();
  await assert.rejects(service.create("google" as never, redirect), /Unsupported/);
  await assert.rejects(service.consume("github", "short", redirect), /Invalid OAuth callback state/);
});

test("enforces a bounded transaction lifetime", () => {
  const store = new MemoryOAuthStore();
  assert.throws(() => new OAuthTransactionService({ store, ttlMs: 10_000 }), /TTL/);
  assert.throws(() => new OAuthTransactionService({ store, ttlMs: 20 * 60_000 }), /TTL/);
});

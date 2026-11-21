import test from "node:test";
import assert from "node:assert/strict";
import { KmsBackedTotpProvider, decodeTotpSecret, generateTotpCode } from "../src/totp-provider.js";
import type { EncryptedTotpSecret, TotpFactorStore, TotpKms } from "../src/totp-provider.js";

class MemoryFactors implements TotpFactorStore {
  record: EncryptedTotpSecret | null = null;
  async find(subject: string) { return this.record?.subject === subject ? this.record : null; }
  async createPending(record: EncryptedTotpSecret) {
    if (this.record) throw new Error("factor exists");
    this.record = record;
  }
  async activate(subject: string) {
    if (!this.record || this.record.subject !== subject || this.record.enabled) return false;
    this.record = Object.freeze({ ...this.record, enabled: true });
    return true;
  }
  async claimStep(subject: string, step: number) {
    if (!this.record || this.record.subject !== subject || step <= this.record.lastAcceptedStep) return false;
    this.record = Object.freeze({ ...this.record, lastAcceptedStep: step });
    return true;
  }
}
class TestKms implements TotpKms {
  private readonly values = new Map<string, Buffer>();
  async encrypt(plaintext: Uint8Array, context: Readonly<Record<string, string>>) {
    const ciphertext = `cipher:${context.subject}`;
    this.values.set(ciphertext, Buffer.from(plaintext));
    return { ciphertext, keyVersion: "test-key-v1" };
  }
  async decrypt(ciphertext: string, keyVersion: string, context: Readonly<Record<string, string>>) {
    assert.equal(keyVersion, "test-key-v1");
    assert.equal(ciphertext, `cipher:${context.subject}`);
    const value = this.values.get(ciphertext);
    if (!value) throw new Error("missing ciphertext");
    return Buffer.from(value);
  }
}

test("matches RFC 6238 SHA-1 test vector at 59 seconds", () => {
  const secret = Buffer.from("12345678901234567890", "ascii");
  assert.equal(generateTotpCode(secret, 1), "287082");
});

test("creates pending encrypted factor and activates only after a valid code", async () => {
  const store = new MemoryFactors();
  const kms = new TestKms();
  const nowMs = 1_700_000_010_000;
  const provider = new KmsBackedTotpProvider({ store, kms, issuer: "TLCE", now: () => nowMs });
  const enrollment = await provider.beginEnrollment("operator-7", "operator-7");
  assert.match(enrollment.otpauthUri, /^otpauth:\/\/totp\//);
  assert.equal(store.record?.enabled, false);
  assert.match(store.record?.ciphertext ?? "", /^cipher:/);
  const secret = decodeTotpSecret(enrollment.secret);
  const step = Math.floor(nowMs / 1000 / 30);
  assert.equal(await provider.confirmEnrollment("operator-7", "000000"), false);
  assert.equal(await provider.confirmEnrollment("operator-7", generateTotpCode(secret, step)), true);
  assert.equal(store.record?.enabled, true);
  assert.equal(await provider.confirmEnrollment("operator-7", generateTotpCode(secret, step)), false);
});

test("accepts a valid code once and rejects replay", async () => {
  const store = new MemoryFactors();
  const kms = new TestKms();
  const nowMs = 1_700_000_010_000;
  const provider = new KmsBackedTotpProvider({ store, kms, issuer: "TLCE", now: () => nowMs });
  const enrollment = await provider.beginEnrollment("operator-8", "operator-8");
  const secret = decodeTotpSecret(enrollment.secret);
  const step = Math.floor(nowMs / 1000 / 30);
  assert.equal(await provider.confirmEnrollment("operator-8", generateTotpCode(secret, step)), true);
  const code = generateTotpCode(secret, step + 1);
  assert.equal(await provider.verify({ subject: "operator-8", code, nowMs: (step + 1) * 30_000 }), true);
  assert.equal(await provider.verify({ subject: "operator-8", code, nowMs: (step + 1) * 30_000 }), false);
});

test("rejects malformed codes, unknown subjects, and invalid time windows", async () => {
  const provider = new KmsBackedTotpProvider({
    store: new MemoryFactors(), kms: new TestKms(), issuer: "TLCE", now: () => 1_700_000_010_000,
  });
  assert.equal(await provider.verify({ subject: "unknown", code: "12345", nowMs: 1_700_000_010_000 }), false);
  assert.equal(await provider.verify({ subject: "../bad", code: "123456", nowMs: 1_700_000_010_000 }), false);
  assert.equal(await provider.verify({ subject: "unknown", code: "123456", nowMs: -1 }), false);
  assert.throws(() => new KmsBackedTotpProvider({
    store: new MemoryFactors(), kms: new TestKms(), issuer: "TLCE", allowedWindow: 2,
  }), /configuration/);
});

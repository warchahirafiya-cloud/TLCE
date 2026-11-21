import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
const SECRET_BYTES = 20;
const SUBJECT = /^[A-Za-z0-9._:@-]{1,200}$/;

export interface EncryptedTotpSecret {
  readonly subject: string;
  readonly ciphertext: string;
  readonly keyVersion: string;
  readonly enabled: boolean;
  readonly lastAcceptedStep: number;
}

export interface TotpFactorStore {
  find(subject: string): Promise<EncryptedTotpSecret | null>;
  createPending(record: EncryptedTotpSecret): Promise<void>;
  activate(subject: string): Promise<boolean>;
  /** Atomic compare-and-set: succeeds only if step is strictly newer. */
  claimStep(subject: string, step: number): Promise<boolean>;
}

/** Adapter to a managed KMS/envelope-encryption service; never implement with a local key in production. */
export interface TotpKms {
  encrypt(plaintext: Uint8Array, context: Readonly<Record<string, string>>): Promise<{
    readonly ciphertext: string;
    readonly keyVersion: string;
  }>;
  decrypt(ciphertext: string, keyVersion: string, context: Readonly<Record<string, string>>): Promise<Uint8Array>;
}

export interface TotpProviderOptions {
  readonly store: TotpFactorStore;
  readonly kms: TotpKms;
  readonly issuer: string;
  readonly now?: () => number;
  readonly allowedWindow?: number;
}

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0, value = 0, output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31];
  return output;
}

function decodeBase32(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, "");
  if (!/^[A-Z2-7]+$/.test(normalized)) throw new Error("Invalid TOTP secret encoding");
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const char of normalized) {
    value = (value << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpCode(secret: Uint8Array, step: number): string {
  if (!Number.isSafeInteger(step) || step < 0) throw new Error("Invalid TOTP time step");
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % (10 ** DIGITS)).padStart(DIGITS, "0");
}

function matchingStep(secret: Uint8Array, code: string, currentStep: number, window: number): number | null {
  const supplied = Buffer.from(code, "ascii");
  for (let delta = -window; delta <= window; delta += 1) {
    const candidateStep = currentStep + delta;
    if (candidateStep < 0) continue;
    const expected = Buffer.from(generateTotpCode(secret, candidateStep), "ascii");
    if (supplied.length === expected.length && timingSafeEqual(supplied, expected)) return candidateStep;
  }
  return null;
}

export class KmsBackedTotpProvider {
  private readonly now: () => number;
  private readonly window: number;

  constructor(private readonly options: TotpProviderOptions) {
    this.now = options.now ?? Date.now;
    this.window = options.allowedWindow ?? 1;
    if (!options.issuer.trim() || !Number.isSafeInteger(this.window) || this.window < 0 || this.window > 1) {
      throw new Error("Invalid TOTP provider configuration");
    }
  }

  /** Creates an encrypted pending factor. Return the provisioning URI once; never log it. */
  async beginEnrollment(subject: string, accountLabel: string): Promise<{ secret: string; otpauthUri: string }> {
    this.validateSubject(subject);
    if (!accountLabel.trim() || accountLabel.length > 200) throw new Error("Invalid TOTP account label");
    const secretBytes = randomBytes(SECRET_BYTES);
    try {
      const encrypted = await this.options.kms.encrypt(secretBytes, this.context(subject));
      if (!encrypted.ciphertext || !encrypted.keyVersion) throw new Error("KMS returned invalid ciphertext metadata");
      await this.options.store.createPending({
        subject,
        ciphertext: encrypted.ciphertext,
        keyVersion: encrypted.keyVersion,
        enabled: false,
        lastAcceptedStep: -1,
      });
      const secret = encodeBase32(secretBytes);
      const label = encodeURIComponent(`${this.options.issuer}:${accountLabel}`);
      const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(this.options.issuer)}&algorithm=SHA1&digits=6&period=30`;
      return Object.freeze({ secret, otpauthUri: uri });
    } finally {
      secretBytes.fill(0);
    }
  }

  /** User must prove possession before a pending factor becomes active. */
  async confirmEnrollment(subject: string, code: string): Promise<boolean> {
    return this.verifyAndClaim(subject, code, false);
  }

  async verify(input: { subject: string; code: string; nowMs: number }): Promise<boolean> {
    if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) return false;
    return this.verifyAndClaim(input.subject, input.code, true, input.nowMs);
  }

  private async verifyAndClaim(subject: string, code: string, requireEnabled: boolean, nowMs = this.now()): Promise<boolean> {
    try { this.validateSubject(subject); } catch { return false; }
    if (typeof code !== "string" || !/^\d{6}$/.test(code) ||
        !Number.isSafeInteger(nowMs) || nowMs < 0) return false;
    const record = await this.options.store.find(subject);
    if (!record || (requireEnabled && !record.enabled) || (!requireEnabled && record.enabled)) return false;
    const secret = await this.options.kms.decrypt(record.ciphertext, record.keyVersion, this.context(subject));
    try {
      if (secret.byteLength !== SECRET_BYTES) return false;
      const step = matchingStep(secret, code, Math.floor(nowMs / 1000 / STEP_SECONDS), this.window);
      if (step === null || step <= record.lastAcceptedStep) return false;
      if (!await this.options.store.claimStep(subject, step)) return false;
      if (!requireEnabled) return this.options.store.activate(subject);
      return true;
    } finally {
      secret.fill(0);
    }
  }

  private context(subject: string): Readonly<Record<string, string>> {
    return Object.freeze({ purpose: "tlce-operator-totp-v1", subject });
  }

  private validateSubject(subject: string): void {
    if (typeof subject !== "string" || !SUBJECT.test(subject)) throw new Error("Invalid TOTP subject");
  }
}

export function decodeTotpSecret(secret: string): Uint8Array {
  return decodeBase32(secret);
}

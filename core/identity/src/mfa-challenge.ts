import { createHash, randomBytes } from "node:crypto";
import type { OperatorRole } from "./operator-authorization.js";
import { OperatorSessionService, type CreatedOperatorSession } from "./operator-session.js";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SUBJECT_PATTERN = /^[A-Za-z0-9._:@-]{1,200}$/;
const MODULE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const ROLES = new Set<OperatorRole>(["viewer", "operator", "maintainer", "security_admin"]);

export interface MfaChallengeRecord {
  readonly challengeTokenHash: string;
  readonly subject: string;
  readonly roles: ReadonlyArray<OperatorRole>;
  readonly allowedModuleIds: ReadonlyArray<string>;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly attempts: number;
}

export interface MfaChallengeStore {
  create(record: MfaChallengeRecord): Promise<void>;
  /** Atomically increments attempts only for a live challenge below the supplied limit. */
  reserveAttempt(hash: string, nowMs: number, maxAttempts: number): Promise<MfaChallengeRecord | null>;
  /** Atomically deletes the challenge. Only one concurrent verifier can complete it. */
  consume(hash: string): Promise<boolean>;
}

/**
 * A production TOTP verifier must decrypt enrolled secrets through a KMS-backed
 * envelope-encryption boundary, enforce a narrow clock window, prevent time-step
 * replay, and rate-limit by subject. No plaintext secret belongs in this service.
 */
export interface TotpFactorVerifier {
  verify(input: { subject: string; code: string; nowMs: number }): Promise<boolean>;
}

export interface MfaChallengeServiceOptions {
  readonly store: MfaChallengeStore;
  readonly sessions: OperatorSessionService;
  readonly verifier: TotpFactorVerifier;
  readonly now?: () => number;
  readonly randomToken?: () => string;
  readonly ttlMs?: number;
  readonly maxAttempts?: number;
}

export interface StartedMfaChallenge {
  readonly challengeToken: string;
  readonly expiresAt: string;
}

export interface CompletedMfaChallenge {
  readonly session: CreatedOperatorSession;
  readonly mfaVerifiedAt: string;
}

/** Server-side, one-time TOTP challenge gate for privileged operator sessions. */
export class MfaChallengeService {
  private readonly now: () => number;
  private readonly randomToken: () => string;
  private readonly ttlMs: number;
  private readonly maxAttempts: number;

  constructor(private readonly options: MfaChallengeServiceOptions) {
    this.now = options.now ?? Date.now;
    this.randomToken = options.randomToken ?? (() => randomBytes(32).toString("base64url"));
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
    this.maxAttempts = options.maxAttempts ?? 5;
    if (!Number.isSafeInteger(this.ttlMs) || this.ttlMs < 30_000 || this.ttlMs > 10 * 60_000 ||
        !Number.isSafeInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 10) {
      throw new Error("Invalid MFA challenge lifetime or attempt limit");
    }
  }

  async begin(input: {
    readonly subject: string;
    readonly roles: ReadonlyArray<OperatorRole>;
    readonly allowedModuleIds: ReadonlyArray<string>;
  }): Promise<StartedMfaChallenge> {
    if (typeof input.subject !== "string" || !SUBJECT_PATTERN.test(input.subject) ||
        !Array.isArray(input.roles) || input.roles.length === 0 ||
        input.roles.some((role) => !ROLES.has(role)) ||
        !Array.isArray(input.allowedModuleIds) ||
        input.allowedModuleIds.some((id) => typeof id !== "string" || !MODULE_PATTERN.test(id))) {
      throw new Error("Invalid MFA challenge identity or policy");
    }
    const now = this.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid MFA challenge clock");
    const challengeToken = this.randomToken();
    if (!TOKEN_PATTERN.test(challengeToken)) throw new Error("Invalid MFA challenge token generator");
    const expiresAtMs = now + this.ttlMs;
    await this.options.store.create(Object.freeze({
      challengeTokenHash: createHash("sha256").update(challengeToken).digest("hex"),
      subject: input.subject,
      roles: Object.freeze([...new Set(input.roles)]),
      allowedModuleIds: Object.freeze([...new Set(input.allowedModuleIds)]),
      createdAtMs: now,
      expiresAtMs,
      attempts: 0,
    }));
    return Object.freeze({ challengeToken, expiresAt: new Date(expiresAtMs).toISOString() });
  }

  async complete(challengeToken: string, code: string): Promise<CompletedMfaChallenge> {
    if (typeof challengeToken !== "string" || !TOKEN_PATTERN.test(challengeToken) ||
        typeof code !== "string" || !/^\d{6}$/.test(code)) {
      throw new Error("MFA challenge is invalid or expired");
    }
    const now = this.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid MFA challenge clock");
    const hash = createHash("sha256").update(challengeToken).digest("hex");
    const challenge = await this.options.store.reserveAttempt(hash, now, this.maxAttempts);
    if (!challenge || challenge.challengeTokenHash !== hash ||
        challenge.expiresAtMs <= now || challenge.attempts > this.maxAttempts) {
      throw new Error("MFA challenge is invalid or expired");
    }

    const verified = await this.options.verifier.verify({
      subject: challenge.subject,
      code,
      nowMs: now,
    });
    if (!verified) throw new Error("MFA challenge is invalid or expired");

    // Consume before issuing a session: concurrent submissions can create at most one session.
    if (!await this.options.store.consume(hash)) {
      throw new Error("MFA challenge is invalid or expired");
    }
    const session = await this.options.sessions.createSession({
      subject: challenge.subject,
      roles: challenge.roles,
      allowedModuleIds: challenge.allowedModuleIds,
    });
    return Object.freeze({ session, mfaVerifiedAt: new Date(now).toISOString() });
  }
}

import { createHash, randomBytes } from "node:crypto";

export type OAuthProvider = "github";

export interface OAuthTransactionRecord {
  readonly stateHash: string;
  readonly provider: OAuthProvider;
  readonly redirectUri: string;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
}

export interface OAuthTransactionStore {
  create(record: OAuthTransactionRecord): Promise<void>;
  /** Atomically consume and delete a state record. Returns null when unknown or expired. */
  consume(stateHash: string, nowMs: number): Promise<OAuthTransactionRecord | null>;
}

export interface OAuthTransactionServiceOptions {
  readonly store: OAuthTransactionStore;
  readonly now?: () => number;
  readonly randomState?: () => string;
  readonly ttlMs?: number;
}

export interface CreatedOAuthTransaction {
  readonly state: string;
  readonly provider: OAuthProvider;
  readonly redirectUri: string;
  readonly expiresAt: string;
}

const STATE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function hashState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

function validateRedirectUri(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid OAuth redirect URI");
  }
  if (parsed.protocol !== "https:" || parsed.origin !== value.split("/").slice(0, 3).join("/") ||
      parsed.username || parsed.password || parsed.hash) {
    throw new Error("OAuth redirect URI must be an exact HTTPS URL without credentials or fragment");
  }
  return value;
}

/**
 * One-time OAuth state lifecycle. Only the SHA-256 state digest is persisted.
 * Provider code exchange and identity verification belong to a separate adapter.
 */
export class OAuthTransactionService {
  private readonly now: () => number;
  private readonly randomState: () => string;
  private readonly ttlMs: number;

  constructor(private readonly options: OAuthTransactionServiceOptions) {
    this.now = options.now ?? Date.now;
    this.randomState = options.randomState ?? (() => randomBytes(32).toString("base64url"));
    this.ttlMs = options.ttlMs ?? 5 * 60_000;
    if (!Number.isSafeInteger(this.ttlMs) || this.ttlMs < 30_000 || this.ttlMs > 15 * 60_000) {
      throw new Error("OAuth transaction TTL must be between 30 seconds and 15 minutes");
    }
  }

  async create(provider: OAuthProvider, redirectUri: string): Promise<CreatedOAuthTransaction> {
    if (provider !== "github") throw new Error("Unsupported OAuth provider");
    const exactRedirectUri = validateRedirectUri(redirectUri);
    const now = this.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid OAuth transaction clock");
    const state = this.randomState();
    if (!STATE_PATTERN.test(state)) throw new Error("OAuth state generator returned an invalid token");
    const expiresAtMs = now + this.ttlMs;
    const record: OAuthTransactionRecord = Object.freeze({
      stateHash: hashState(state),
      provider,
      redirectUri: exactRedirectUri,
      createdAtMs: now,
      expiresAtMs,
    });
    await this.options.store.create(record);
    return Object.freeze({
      state,
      provider,
      redirectUri: exactRedirectUri,
      expiresAt: new Date(expiresAtMs).toISOString(),
    });
  }

  async consume(provider: OAuthProvider, state: string, expectedRedirectUri: string): Promise<{ readonly redirectUri: string }> {
    if (provider !== "github" || !STATE_PATTERN.test(state)) {
      throw new Error("Invalid OAuth callback state");
    }
    const redirectUri = validateRedirectUri(expectedRedirectUri);
    const now = this.now();
    if (!Number.isSafeInteger(now) || now < 0) throw new Error("Invalid OAuth transaction clock");
    const hash = hashState(state);
    if (!HASH_PATTERN.test(hash)) throw new Error("Invalid OAuth state digest");
    const record = await this.options.store.consume(hash, now);
    if (!record || record.provider !== provider || record.redirectUri !== redirectUri) {
      throw new Error("OAuth transaction is invalid, expired, or does not match this callback");
    }
    return Object.freeze({ redirectUri: record.redirectUri });
  }
}

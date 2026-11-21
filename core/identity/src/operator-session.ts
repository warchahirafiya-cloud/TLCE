import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { OperatorRole } from "./operator-authorization";

const SESSION_COOKIE_NAME = "__Host-tlce_session";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SUBJECT_PATTERN = /^[A-Za-z0-9._:@-]{1,200}$/;
const MODULE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const KNOWN_ROLES = new Set<OperatorRole>(["viewer", "operator", "maintainer", "security_admin"]);

export interface OperatorSessionInput {
  readonly subject: string;
  readonly roles: ReadonlyArray<OperatorRole>;
  readonly allowedModuleIds: ReadonlyArray<string>;
}

export interface OperatorSessionRecord {
  /** SHA-256 digest of the opaque cookie token. The raw token is never persisted. */
  readonly sessionTokenHash: string;
  readonly subject: string;
  readonly roles: ReadonlyArray<OperatorRole>;
  readonly allowedModuleIds: ReadonlyArray<string>;
  readonly csrfTokenHash: string;
  readonly createdAtMs: number;
  readonly lastSeenAtMs: number;
  readonly idleExpiresAtMs: number;
  readonly absoluteExpiresAtMs: number;
}

export interface OperatorSessionStore {
  create(record: OperatorSessionRecord): Promise<void>;
  find(sessionTokenHash: string): Promise<OperatorSessionRecord | null>;
  replace(record: OperatorSessionRecord): Promise<void>;
  delete(sessionTokenHash: string): Promise<void>;
}

export interface OperatorSessionServiceOptions {
  readonly store: OperatorSessionStore;
  readonly now?: () => number;
  readonly randomToken?: () => string;
  readonly absoluteTtlMs?: number;
  readonly idleTtlMs?: number;
}

export interface CreatedOperatorSession {
  readonly sessionToken: string;
  readonly csrfToken: string;
  readonly cookie: string;
  readonly expiresAt: string;
}

export interface ResolvedOperatorSession {
  readonly subject: string;
  readonly roles: ReadonlyArray<OperatorRole>;
  readonly allowedModuleIds: ReadonlyArray<string>;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeTokenEqual(left: string, rightHash: string): boolean {
  const leftHash = Buffer.from(sha256(left), "hex");
  const right = Buffer.from(rightHash, "hex");
  return right.length === leftHash.length && timingSafeEqual(leftHash, right);
}

function validateToken(token: string): boolean {
  return typeof token === "string" && TOKEN_PATTERN.test(token);
}

function validateOperator(input: OperatorSessionInput): OperatorSessionInput {
  if (typeof input.subject !== "string" || !SUBJECT_PATTERN.test(input.subject)) {
    throw new Error("Invalid TLCE operator subject");
  }
  if (!Array.isArray(input.roles) || input.roles.length === 0 ||
      input.roles.some((role) => !KNOWN_ROLES.has(role))) {
    throw new Error("Invalid TLCE operator roles");
  }
  if (!Array.isArray(input.allowedModuleIds) ||
      input.allowedModuleIds.some((id) => typeof id !== "string" || !MODULE_ID_PATTERN.test(id))) {
    throw new Error("Invalid TLCE operator module scope");
  }
  return Object.freeze({
    subject: input.subject,
    roles: Object.freeze([...new Set(input.roles)]),
    allowedModuleIds: Object.freeze([...new Set(input.allowedModuleIds)]),
  });
}

/** Build the host-only session cookie. No Domain attribute is permitted for __Host-. */
export function createOperatorSessionCookie(token: string, maxAgeSeconds: number): string {
  if (!validateToken(token) || !Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds < 1) {
    throw new Error("Invalid operator session cookie parameters");
  }
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearOperatorSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Opaque operator-session lifecycle. Persistence is injected; production must use
 * a durable server-side store. Only token digests are written to that store.
 */
export class OperatorSessionService {
  private readonly now: () => number;
  private readonly randomToken: () => string;
  private readonly absoluteTtlMs: number;
  private readonly idleTtlMs: number;

  constructor(private readonly options: OperatorSessionServiceOptions) {
    this.now = options.now ?? Date.now;
    this.randomToken = options.randomToken ?? (() => randomBytes(32).toString("base64url"));
    this.absoluteTtlMs = options.absoluteTtlMs ?? 8 * 60 * 60 * 1000;
    this.idleTtlMs = options.idleTtlMs ?? 30 * 60 * 1000;
    if (!Number.isSafeInteger(this.absoluteTtlMs) || this.absoluteTtlMs < 60_000 ||
        !Number.isSafeInteger(this.idleTtlMs) || this.idleTtlMs < 60_000 ||
        this.idleTtlMs > this.absoluteTtlMs) {
      throw new Error("Invalid operator session lifetime configuration");
    }
  }

  async createSession(input: OperatorSessionInput): Promise<CreatedOperatorSession> {
    const operator = validateOperator(input);
    const now = this.now();
    if (!Number.isFinite(now)) throw new Error("Invalid session clock");
    const sessionToken = this.issueToken();
    const csrfToken = this.issueToken();
    const absoluteExpiresAtMs = now + this.absoluteTtlMs;
    const record: OperatorSessionRecord = Object.freeze({
      sessionTokenHash: sha256(sessionToken),
      subject: operator.subject,
      roles: operator.roles,
      allowedModuleIds: operator.allowedModuleIds,
      csrfTokenHash: sha256(csrfToken),
      createdAtMs: now,
      lastSeenAtMs: now,
      idleExpiresAtMs: Math.min(now + this.idleTtlMs, absoluteExpiresAtMs),
      absoluteExpiresAtMs,
    });
    await this.options.store.create(record);
    return Object.freeze({
      sessionToken,
      csrfToken,
      cookie: createOperatorSessionCookie(sessionToken, Math.ceil(this.absoluteTtlMs / 1000)),
      expiresAt: new Date(absoluteExpiresAtMs).toISOString(),
    });
  }

  async resolveSession(sessionToken: string): Promise<ResolvedOperatorSession | null> {
    const record = await this.findActiveRecord(sessionToken);
    if (!record) return null;
    return Object.freeze({
      subject: record.subject,
      roles: Object.freeze([...record.roles]),
      allowedModuleIds: Object.freeze([...record.allowedModuleIds]),
    });
  }

  /** Rotate the CSRF token on each authenticated session bootstrap response. */
  async issueCsrfToken(sessionToken: string): Promise<string | null> {
    const record = await this.findActiveRecord(sessionToken);
    if (!record) return null;
    const csrfToken = this.issueToken();
    await this.options.store.replace(Object.freeze({
      ...record,
      csrfTokenHash: sha256(csrfToken),
    }));
    return csrfToken;
  }

  async validateCsrfToken(sessionToken: string, csrfToken: string): Promise<boolean> {
    if (!validateToken(csrfToken)) return false;
    const record = await this.findActiveRecord(sessionToken);
    return record !== null && safeTokenEqual(csrfToken, record.csrfTokenHash);
  }

  async revokeSession(sessionToken: string): Promise<void> {
    if (!validateToken(sessionToken)) return;
    await this.options.store.delete(sha256(sessionToken));
  }

  private issueToken(): string {
    const token = this.randomToken();
    if (!validateToken(token)) throw new Error("Session token generator returned an invalid token");
    return token;
  }

  private async findActiveRecord(sessionToken: string): Promise<OperatorSessionRecord | null> {
    if (!validateToken(sessionToken)) return null;
    const sessionTokenHash = sha256(sessionToken);
    const record = await this.options.store.find(sessionTokenHash);
    if (!record) return null;
    const now = this.now();
    if (!Number.isFinite(now) || now >= record.absoluteExpiresAtMs || now >= record.idleExpiresAtMs) {
      await this.options.store.delete(sessionTokenHash);
      return null;
    }
    const updated = Object.freeze({
      ...record,
      lastSeenAtMs: now,
      idleExpiresAtMs: Math.min(now + this.idleTtlMs, record.absoluteExpiresAtMs),
    });
    await this.options.store.replace(updated);
    return updated;
  }
}

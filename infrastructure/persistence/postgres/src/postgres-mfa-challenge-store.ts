import type {
  MfaChallengeRecord,
  MfaChallengeStore,
} from "../../../../core/identity/src/mfa-challenge.js";
import type { OperatorRole } from "../../../../core/identity/src/operator-authorization.js";
import type { PostgresQueryExecutor } from "./postgres-operator-session-store.js";

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SUBJECT_PATTERN = /^[A-Za-z0-9._:@-]{1,200}$/;
const MODULE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const ROLES = new Set<OperatorRole>(["viewer", "operator", "maintainer", "security_admin"]);

interface MfaChallengeRow extends Record<string, unknown> {
  challenge_token_hash: unknown;
  subject: unknown;
  roles: unknown;
  allowed_module_ids: unknown;
  created_at_ms: unknown;
  expires_at_ms: unknown;
  attempts: unknown;
}

function parseArray(value: unknown): unknown[] {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error("Invalid persisted MFA challenge policy");
  return parsed;
}

function mapRow(row: MfaChallengeRow): MfaChallengeRecord {
  if (typeof row.challenge_token_hash !== "string" || !HASH_PATTERN.test(row.challenge_token_hash) ||
      typeof row.subject !== "string" || !SUBJECT_PATTERN.test(row.subject)) {
    throw new Error("Invalid persisted MFA challenge identity");
  }
  const roles = parseArray(row.roles);
  const modules = parseArray(row.allowed_module_ids);
  if (roles.length === 0 || roles.some((role) => typeof role !== "string" || !ROLES.has(role as OperatorRole)) ||
      modules.some((id) => typeof id !== "string" || !MODULE_PATTERN.test(id))) {
    throw new Error("Invalid persisted MFA challenge policy");
  }
  const createdAtMs = Number(row.created_at_ms);
  const expiresAtMs = Number(row.expires_at_ms);
  const attempts = Number(row.attempts);
  if (![createdAtMs, expiresAtMs, attempts].every(Number.isSafeInteger) ||
      createdAtMs < 0 || expiresAtMs <= createdAtMs || attempts < 0) {
    throw new Error("Invalid persisted MFA challenge lifetime");
  }
  return Object.freeze({
    challengeTokenHash: row.challenge_token_hash,
    subject: row.subject,
    roles: Object.freeze([...new Set(roles as OperatorRole[])]),
    allowedModuleIds: Object.freeze([...new Set(modules as string[])]),
    createdAtMs,
    expiresAtMs,
    attempts,
  });
}

/** PostgreSQL adapter. Attempt reservation and challenge consumption are atomic. */
export class PostgresMfaChallengeStore implements MfaChallengeStore {
  constructor(private readonly database: PostgresQueryExecutor) {}

  async create(record: MfaChallengeRecord): Promise<void> {
    if (!HASH_PATTERN.test(record.challengeTokenHash) || !SUBJECT_PATTERN.test(record.subject) ||
        record.roles.length === 0 || record.roles.some((role) => !ROLES.has(role)) ||
        record.allowedModuleIds.some((id) => !MODULE_PATTERN.test(id)) ||
        !Number.isSafeInteger(record.createdAtMs) || !Number.isSafeInteger(record.expiresAtMs) ||
        record.createdAtMs < 0 || record.expiresAtMs <= record.createdAtMs || record.attempts !== 0) {
      throw new Error("Invalid MFA challenge record");
    }
    await this.database.query(
      `INSERT INTO tlce_mfa_challenges
       (challenge_token_hash, subject, roles, allowed_module_ids, created_at_ms, expires_at_ms, attempts)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, 0)`,
      [record.challengeTokenHash, record.subject, JSON.stringify(record.roles),
        JSON.stringify(record.allowedModuleIds), record.createdAtMs, record.expiresAtMs],
    );
  }

  async reserveAttempt(hash: string, nowMs: number, maxAttempts: number): Promise<MfaChallengeRecord | null> {
    if (!HASH_PATTERN.test(hash) || !Number.isSafeInteger(nowMs) || nowMs < 0 ||
        !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) return null;
    const result = await this.database.query<MfaChallengeRow>(
      `UPDATE tlce_mfa_challenges SET attempts = attempts + 1
       WHERE challenge_token_hash = $1 AND expires_at_ms > $2 AND attempts < $3
       RETURNING challenge_token_hash, subject, roles, allowed_module_ids, created_at_ms, expires_at_ms, attempts`,
      [hash, nowMs, maxAttempts],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async consume(hash: string): Promise<boolean> {
    if (!HASH_PATTERN.test(hash)) return false;
    const result = await this.database.query(
      "DELETE FROM tlce_mfa_challenges WHERE challenge_token_hash = $1",
      [hash],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async deleteExpired(nowMs: number, batchSize = 500): Promise<number> {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0 ||
        !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 10_000) {
      throw new Error("Invalid MFA challenge cleanup parameters");
    }
    const result = await this.database.query(
      `WITH expired AS (
        SELECT challenge_token_hash FROM tlce_mfa_challenges
        WHERE expires_at_ms <= $1
        ORDER BY expires_at_ms ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM tlce_mfa_challenges AS challenges
      USING expired
      WHERE challenges.challenge_token_hash = expired.challenge_token_hash`,
      [nowMs, batchSize],
    );
    return result.rowCount ?? 0;
  }
}

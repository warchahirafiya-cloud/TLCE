import type {
  OperatorSessionRecord,
  OperatorSessionStore,
} from "../../../core/identity/src/operator-session.js";
import type { OperatorRole } from "../../../core/identity/src/operator-authorization.js";

export interface PostgresQueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly rows: ReadonlyArray<Row>;
  readonly rowCount: number | null;
}

/** Minimal pg-compatible query surface; inject a configured Pool or Client. */
export interface PostgresQueryExecutor {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: ReadonlyArray<unknown>,
  ): Promise<PostgresQueryResult<Row>>;
}

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SUBJECT_PATTERN = /^[A-Za-z0-9._:@-]{1,200}$/;
const MODULE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const ROLES = new Set<OperatorRole>(["viewer", "operator", "maintainer", "security_admin"]);

interface SessionRow extends Record<string, unknown> {
  session_token_hash: unknown;
  subject: unknown;
  roles: unknown;
  allowed_module_ids: unknown;
  csrf_token_hash: unknown;
  created_at_ms: unknown;
  last_seen_at_ms: unknown;
  idle_expires_at_ms: unknown;
  absolute_expires_at_ms: unknown;
}

function parseJsonArray<T>(value: unknown, label: string): ReadonlyArray<T> {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) throw new Error(`Invalid persisted operator session ${label}`);
  return parsed as ReadonlyArray<T>;
}

function parseSafeInteger(value: unknown, label: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid persisted operator session ${label}`);
  }
  return parsed;
}

function mapSessionRow(row: SessionRow): OperatorSessionRecord {
  const sessionTokenHash = row.session_token_hash;
  const csrfTokenHash = row.csrf_token_hash;
  const subject = row.subject;
  if (typeof sessionTokenHash !== "string" || !HASH_PATTERN.test(sessionTokenHash) ||
      typeof csrfTokenHash !== "string" || !HASH_PATTERN.test(csrfTokenHash) ||
      typeof subject !== "string" || !SUBJECT_PATTERN.test(subject)) {
    throw new Error("Invalid persisted operator session identity");
  }

  const roles = parseJsonArray<unknown>(row.roles, "roles");
  if (roles.length === 0 || roles.some((role) => typeof role !== "string" || !ROLES.has(role as OperatorRole))) {
    throw new Error("Invalid persisted operator session roles");
  }
  const allowedModuleIds = parseJsonArray<unknown>(row.allowed_module_ids, "module scope");
  if (allowedModuleIds.some((id) => typeof id !== "string" || !MODULE_PATTERN.test(id))) {
    throw new Error("Invalid persisted operator session module scope");
  }

  const record = Object.freeze({
    sessionTokenHash,
    subject,
    roles: Object.freeze([...new Set(roles as OperatorRole[])]),
    allowedModuleIds: Object.freeze([...new Set(allowedModuleIds as string[])]),
    csrfTokenHash,
    createdAtMs: parseSafeInteger(row.created_at_ms, "created timestamp"),
    lastSeenAtMs: parseSafeInteger(row.last_seen_at_ms, "last-seen timestamp"),
    idleExpiresAtMs: parseSafeInteger(row.idle_expires_at_ms, "idle expiry"),
    absoluteExpiresAtMs: parseSafeInteger(row.absolute_expires_at_ms, "absolute expiry"),
  });
  if (record.lastSeenAtMs < record.createdAtMs ||
      record.idleExpiresAtMs > record.absoluteExpiresAtMs ||
      record.absoluteExpiresAtMs <= record.createdAtMs) {
    throw new Error("Invalid persisted operator session lifetime");
  }
  return record;
}

function validateRecord(record: OperatorSessionRecord): void {
  if (!HASH_PATTERN.test(record.sessionTokenHash) || !HASH_PATTERN.test(record.csrfTokenHash)) {
    throw new Error("Invalid operator session token digest");
  }
  if (!SUBJECT_PATTERN.test(record.subject) || record.roles.length === 0 ||
      record.roles.some((role) => !ROLES.has(role)) ||
      record.allowedModuleIds.some((id) => !MODULE_PATTERN.test(id))) {
    throw new Error("Invalid operator session record");
  }
  for (const value of [record.createdAtMs, record.lastSeenAtMs, record.idleExpiresAtMs, record.absoluteExpiresAtMs]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid operator session timestamp");
  }
  if (record.lastSeenAtMs < record.createdAtMs ||
      record.idleExpiresAtMs > record.absoluteExpiresAtMs ||
      record.absoluteExpiresAtMs <= record.createdAtMs) {
    throw new Error("Invalid operator session lifetime");
  }
}

/**
 * PostgreSQL-backed session store.
 * All values are parameterized; raw session and CSRF tokens are never accepted.
 */
export class PostgresOperatorSessionStore implements OperatorSessionStore {
  constructor(private readonly database: PostgresQueryExecutor) {}

  async create(record: OperatorSessionRecord): Promise<void> {
    validateRecord(record);
    await this.database.query(
      `INSERT INTO tlce_operator_sessions (
        session_token_hash, subject, roles, allowed_module_ids, csrf_token_hash,
        created_at_ms, last_seen_at_ms, idle_expires_at_ms, absolute_expires_at_ms
      ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8, $9)`,
      [
        record.sessionTokenHash, record.subject, JSON.stringify(record.roles),
        JSON.stringify(record.allowedModuleIds), record.csrfTokenHash,
        record.createdAtMs, record.lastSeenAtMs, record.idleExpiresAtMs, record.absoluteExpiresAtMs,
      ],
    );
  }

  async find(sessionTokenHash: string): Promise<OperatorSessionRecord | null> {
    if (!HASH_PATTERN.test(sessionTokenHash)) return null;
    const result = await this.database.query<SessionRow>(
      `SELECT session_token_hash, subject, roles, allowed_module_ids, csrf_token_hash,
        created_at_ms, last_seen_at_ms, idle_expires_at_ms, absolute_expires_at_ms
       FROM tlce_operator_sessions WHERE session_token_hash = $1 LIMIT 1`,
      [sessionTokenHash],
    );
    return result.rows[0] ? mapSessionRow(result.rows[0]) : null;
  }

  async replace(record: OperatorSessionRecord): Promise<void> {
    validateRecord(record);
    const result = await this.database.query(
      `UPDATE tlce_operator_sessions SET
        subject = $2, roles = $3::jsonb, allowed_module_ids = $4::jsonb,
        csrf_token_hash = $5, created_at_ms = $6, last_seen_at_ms = $7,
        idle_expires_at_ms = $8, absolute_expires_at_ms = $9
       WHERE session_token_hash = $1`,
      [
        record.sessionTokenHash, record.subject, JSON.stringify(record.roles),
        JSON.stringify(record.allowedModuleIds), record.csrfTokenHash,
        record.createdAtMs, record.lastSeenAtMs, record.idleExpiresAtMs, record.absoluteExpiresAtMs,
      ],
    );
    if (result.rowCount === 0) throw new Error("Operator session does not exist");
  }

  async delete(sessionTokenHash: string): Promise<void> {
    if (!HASH_PATTERN.test(sessionTokenHash)) return;
    await this.database.query(
      "DELETE FROM tlce_operator_sessions WHERE session_token_hash = $1",
      [sessionTokenHash],
    );
  }

  /** Run from a scheduled maintenance task; never invoked on an end-user request. */
  async deleteExpired(nowMs: number, batchSize = 500): Promise<number> {
    if (!Number.isSafeInteger(nowMs) || nowMs < 0 ||
        !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 10_000) {
      throw new Error("Invalid operator-session cleanup parameters");
    }
    const result = await this.database.query(
      `WITH expired AS (
        SELECT session_token_hash FROM tlce_operator_sessions
        WHERE idle_expires_at_ms <= $1 OR absolute_expires_at_ms <= $1
        ORDER BY absolute_expires_at_ms ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM tlce_operator_sessions AS sessions
      USING expired
      WHERE sessions.session_token_hash = expired.session_token_hash`,
      [nowMs, batchSize],
    );
    return result.rowCount ?? 0;
  }
}

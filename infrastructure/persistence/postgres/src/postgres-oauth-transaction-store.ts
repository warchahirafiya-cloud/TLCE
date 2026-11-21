import type {
  OAuthProvider,
  OAuthTransactionRecord,
  OAuthTransactionStore,
} from "../../../../core/identity/src/oauth-transaction.js";
import type { PostgresQueryExecutor } from "./postgres-operator-session-store.js";

interface OAuthTransactionRow extends Record<string, unknown> {
  state_hash: unknown;
  provider: unknown;
  redirect_uri: unknown;
  created_at_ms: unknown;
  expires_at_ms: unknown;
}

/** PostgreSQL adapter with atomic DELETE ... RETURNING state consumption. */
export class PostgresOAuthTransactionStore implements OAuthTransactionStore {
  constructor(private readonly database: PostgresQueryExecutor) {}

  async create(record: OAuthTransactionRecord): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(record.stateHash) ||
        record.provider !== "github" ||
        !Number.isSafeInteger(record.createdAtMs) ||
        !Number.isSafeInteger(record.expiresAtMs) ||
        record.expiresAtMs <= record.createdAtMs ||
        !isExactHttpsUrl(record.redirectUri)) {
      throw new Error("Invalid OAuth transaction record");
    }
    await this.database.query(
      `INSERT INTO tlce_oauth_transactions
       (state_hash, provider, redirect_uri, created_at_ms, expires_at_ms)
       VALUES ($1, $2, $3, $4, $5)`,
      [record.stateHash, record.provider, record.redirectUri, record.createdAtMs, record.expiresAtMs],
    );
  }

  async consume(stateHash: string, nowMs: number): Promise<OAuthTransactionRecord | null> {
    if (!/^[a-f0-9]{64}$/.test(stateHash) || !Number.isSafeInteger(nowMs) || nowMs < 0) return null;
    const result = await this.database.query<OAuthTransactionRow>(
      `DELETE FROM tlce_oauth_transactions
       WHERE state_hash = $1
       RETURNING state_hash, provider, redirect_uri, created_at_ms, expires_at_ms`,
      [stateHash],
    );
    const row = result.rows[0];
    if (!row) return null;
    if (row.state_hash !== stateHash || row.provider !== "github" ||
        typeof row.redirect_uri !== "string" || !isExactHttpsUrl(row.redirect_uri)) {
      throw new Error("Invalid persisted OAuth transaction");
    }
    const createdAtMs = Number(row.created_at_ms);
    const expiresAtMs = Number(row.expires_at_ms);
    if (!Number.isSafeInteger(createdAtMs) || !Number.isSafeInteger(expiresAtMs) ||
        expiresAtMs <= createdAtMs) {
      throw new Error("Invalid persisted OAuth transaction lifetime");
    }
    if (expiresAtMs <= nowMs) return null;
    return Object.freeze({
      stateHash,
      provider: row.provider as OAuthProvider,
      redirectUri: row.redirect_uri,
      createdAtMs,
      expiresAtMs,
    });
  }
}

function isExactHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" &&
      parsed.origin === value.split("/").slice(0, 3).join("/") &&
      !parsed.username && !parsed.password && !parsed.hash;
  } catch {
    return false;
  }
}

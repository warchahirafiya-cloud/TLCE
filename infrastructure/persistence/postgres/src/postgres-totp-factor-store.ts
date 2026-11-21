import type { TotpFactorStore, EncryptedTotpSecret } from "../../../../core/identity/src/totp-provider.js";
import type { PostgresQueryExecutor } from "./postgres-operator-session-store.js";

interface FactorRow extends Record<string, unknown> {
  subject: unknown;
  ciphertext: unknown;
  key_version: unknown;
  enabled: unknown;
  last_accepted_step: unknown;
}

function mapRow(row: FactorRow): EncryptedTotpSecret {
  if (typeof row.subject !== "string" || typeof row.ciphertext !== "string" ||
      typeof row.key_version !== "string" || typeof row.enabled !== "boolean") {
    throw new Error("Invalid persisted TOTP factor");
  }
  const lastAcceptedStep = Number(row.last_accepted_step);
  if (!Number.isSafeInteger(lastAcceptedStep) || lastAcceptedStep < -1) {
    throw new Error("Invalid persisted TOTP replay counter");
  }
  return Object.freeze({
    subject: row.subject,
    ciphertext: row.ciphertext,
    keyVersion: row.key_version,
    enabled: row.enabled,
    lastAcceptedStep,
  });
}

/** Stores only KMS ciphertext and an atomic replay counter; plaintext TOTP seeds never enter PostgreSQL. */
export class PostgresTotpFactorStore implements TotpFactorStore {
  constructor(private readonly database: PostgresQueryExecutor) {}

  async find(subject: string): Promise<EncryptedTotpSecret | null> {
    const result = await this.database.query<FactorRow>(
      "SELECT subject, ciphertext, key_version, enabled, last_accepted_step FROM tlce_totp_factors WHERE subject = $1 LIMIT 1",
      [subject],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  async createPending(record: EncryptedTotpSecret): Promise<void> {
    if (!record.subject || !record.ciphertext || !record.keyVersion ||
        record.enabled || record.lastAcceptedStep !== -1) throw new Error("Invalid pending TOTP factor");
    await this.database.query(
      "INSERT INTO tlce_totp_factors (subject, ciphertext, key_version, enabled, last_accepted_step, created_at) VALUES ($1, $2, $3, FALSE, -1, NOW())",
      [record.subject, record.ciphertext, record.keyVersion],
    );
  }

  async activate(subject: string): Promise<boolean> {
    const result = await this.database.query(
      "UPDATE tlce_totp_factors SET enabled = TRUE, updated_at = NOW() WHERE subject = $1 AND enabled = FALSE",
      [subject],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async claimStep(subject: string, step: number): Promise<boolean> {
    if (!Number.isSafeInteger(step) || step < 0) return false;
    const result = await this.database.query(
      "UPDATE tlce_totp_factors SET last_accepted_step = $2, updated_at = NOW() WHERE subject = $1 AND last_accepted_step < $2",
      [subject, step],
    );
    return (result.rowCount ?? 0) === 1;
  }
}

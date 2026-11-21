import {
  createAuditRecord,
  type AuditRecord,
  type AuditSink,
} from "../../../../core/audit/src/audit.js";

/** Minimal parameterized PostgreSQL query surface for the audit writer. */
export interface PostgresAuditQueryExecutor {
  query(
    text: string,
    values?: ReadonlyArray<unknown>,
  ): Promise<{ readonly rows: ReadonlyArray<Record<string, unknown>>; readonly rowCount: number | null }>;
}

/**
 * Append-only application interface for PostgreSQL audit events.
 * The database role used by this sink should have INSERT only on the audit table.
 */
export class PostgresAuditSink implements AuditSink {
  constructor(private readonly database: PostgresAuditQueryExecutor) {}

  async write(record: AuditRecord): Promise<void> {
    const safe = createAuditRecord(record);
    await this.database.query(
      `INSERT INTO tlce_audit_records (
        audit_id, occurred_at, request_id, actor_id, actor_type, module_id,
        action, resource_type, resource_id, outcome, metadata
      ) VALUES ($1, $2::timestamptz, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        safe.auditId,
        safe.occurredAt,
        safe.requestId,
        safe.actorId,
        safe.actorType,
        safe.moduleId,
        safe.action,
        safe.resourceType,
        safe.resourceId ?? null,
        safe.outcome,
        JSON.stringify(safe.metadata),
      ],
    );
  }
}

import type { TlceEvent } from "../contracts/events.js";
import type { DeadLetterSink, EventClaimResult, EventDeduplicationStore } from "./event-processor.js";

/** Minimal PostgreSQL-compatible query boundary; inject the driver's pool/client adapter. */
export interface SqlQueryResult<TRow extends Record<string, unknown> = Record<string, unknown>> {
  rows: TRow[];
  rowCount: number | null;
}

export interface SqlExecutor {
  query<TRow extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<SqlQueryResult<TRow>>;
}

export interface PostgresEventStoreOptions {
  /** Must exceed the normal maximum consumer execution time. Expired claims can be reclaimed. */
  leaseDurationMs?: number;
}

/**
 * Durable PostgreSQL adapter for event idempotency and dead-letter persistence.
 * The injected executor should be a trusted pool or transaction-capable client.
 * The SQL schema is in migrations/001_event_delivery.sql.
 */
export class PostgresEventStore implements EventDeduplicationStore, DeadLetterSink {
  private readonly leaseDurationMs: number;

  constructor(private readonly sql: SqlExecutor, options: PostgresEventStoreOptions = {}) {
    this.leaseDurationMs = options.leaseDurationMs ?? 60_000;
    if (!Number.isSafeInteger(this.leaseDurationMs) ||
        this.leaseDurationMs < 1_000 || this.leaseDurationMs > 86_400_000) {
      throw new Error("leaseDurationMs must be between 1000 and 86400000");
    }
    if (!sql || typeof sql.query !== "function") {
      throw new Error("PostgresEventStore requires a SQL executor");
    }
  }

  async claim(key: string): Promise<EventClaimResult> {
    if (typeof key !== "string" || !key.trim() || key.length > 512) {
      throw new Error("Invalid event deduplication key");
    }

    const claimed = await this.sql.query(
      `INSERT INTO tlce_event_deduplication
        (dedupe_key, status, lease_until, attempts, created_at, updated_at)
       VALUES ($1, 'in_progress', CURRENT_TIMESTAMP + ($2 * INTERVAL '1 millisecond'), 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (dedupe_key) DO UPDATE
         SET status = 'in_progress',
             lease_until = CURRENT_TIMESTAMP + ($2 * INTERVAL '1 millisecond'),
             attempts = tlce_event_deduplication.attempts + 1,
             updated_at = CURRENT_TIMESTAMP
       WHERE tlce_event_deduplication.status = 'failed'
          OR (tlce_event_deduplication.status = 'in_progress'
              AND tlce_event_deduplication.lease_until <= CURRENT_TIMESTAMP)
       RETURNING dedupe_key`,
      [key, this.leaseDurationMs],
    );
    if (claimed.rows.length > 0) return "claimed";

    const existing = await this.sql.query<{ status: string }>(
      "SELECT status FROM tlce_event_deduplication WHERE dedupe_key = $1",
      [key],
    );
    if (existing.rows[0]?.status === "completed") return "completed";
    if (existing.rows[0]?.status === "in_progress") return "in_progress";

    // A concurrent delete or transaction race should be retried by the caller.
    throw new Error("Unable to determine durable event claim state");
  }

  async markCompleted(key: string): Promise<void> {
    const result = await this.sql.query(
      `UPDATE tlce_event_deduplication
       SET status = 'completed', lease_until = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE dedupe_key = $1 AND status = 'in_progress'`,
      [key],
    );
    if (result.rowCount !== 1) {
      throw new Error("Cannot complete an event without an active durable claim");
    }
  }

  async release(key: string): Promise<void> {
    const result = await this.sql.query(
      `UPDATE tlce_event_deduplication
       SET status = 'failed', lease_until = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE dedupe_key = $1 AND status = 'in_progress'`,
      [key],
    );
    if (result.rowCount !== 1) {
      throw new Error("Cannot release an event without an active durable claim");
    }
  }

  async record<TPayload extends Record<string, unknown>>(
    event: TlceEvent<TPayload>,
    failure: { attempts: number; reason: string; failedAt: string },
  ): Promise<void> {
    if (!event || typeof event.eventId !== "string" || !event.eventId.trim()) {
      throw new Error("Dead-letter event requires an event ID");
    }
    if (!Number.isSafeInteger(failure.attempts) || failure.attempts < 1 ||
        typeof failure.reason !== "string" || typeof failure.failedAt !== "string" ||
        Number.isNaN(Date.parse(failure.failedAt))) {
      throw new Error("Invalid dead-letter failure metadata");
    }

    await this.sql.query(
      `INSERT INTO tlce_dead_letters (event_id, event_type, producer_module, event_data, failure_data, failed_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::timestamptz)
       ON CONFLICT (event_id) DO UPDATE
         SET failure_data = EXCLUDED.failure_data, failed_at = EXCLUDED.failed_at`,
      [
        event.eventId,
        event.eventType,
        event.producerModule,
        JSON.stringify(event),
        JSON.stringify({
          attempts: failure.attempts,
          reason: failure.reason.slice(0, 500),
          failedAt: failure.failedAt,
        }),
        failure.failedAt,
      ],
    );
  }
}

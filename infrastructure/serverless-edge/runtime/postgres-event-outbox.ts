import type { EventPublishOptions, EventPublisher, TlceEvent } from "../contracts/events.js";
import type { SqlExecutor } from "./postgres-event-store.js";

export interface ClaimedOutboxEvent {
  eventId: string;
  eventType: string;
  producerModule: string;
  eventData: TlceEvent;
  leaseOwner: string;
  attempts: number;
}

export interface PostgresOutboxOptions {
  leaseDurationMs?: number;
  maxBatchSize?: number;
}

/**
 * Transactional outbox writer/dispatcher primitives. The producer's business
 * mutation and publish() must share the same database transaction/executor.
 * A worker must publish externally before markPublished(); retries are at-least-once.
 */
export class PostgresEventOutbox implements EventPublisher {
  private readonly leaseDurationMs: number;
  private readonly maxBatchSize: number;

  constructor(private readonly sql: SqlExecutor, options: PostgresOutboxOptions = {}) {
    this.leaseDurationMs = options.leaseDurationMs ?? 30_000;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    if (!Number.isSafeInteger(this.leaseDurationMs) || this.leaseDurationMs < 1_000 ||
        this.leaseDurationMs > 86_400_000) throw new Error("Invalid outbox lease duration");
    if (!Number.isSafeInteger(this.maxBatchSize) || this.maxBatchSize < 1 ||
        this.maxBatchSize > 1_000) throw new Error("Invalid outbox max batch size");
    if (!sql || typeof sql.query !== "function") throw new Error("Outbox requires a SQL executor");
  }

  async publish<TPayload extends Record<string, unknown>>(
    event: TlceEvent<TPayload>,
    options: EventPublishOptions = {},
  ): Promise<void> {
    validateOutboxEvent(event);
    const partitionKey = options.partitionKey;
    if (partitionKey !== undefined &&
        (typeof partitionKey !== "string" || partitionKey.length > 128)) {
      throw new Error("Invalid outbox partition key");
    }
    await this.sql.query(
      `INSERT INTO tlce_event_outbox
        (event_id, event_type, producer_module, partition_key, event_data, status, attempts, available_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'pending', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (event_id) DO NOTHING`,
      [event.eventId, event.eventType, event.producerModule, partitionKey ?? null, JSON.stringify(event)],
    );
  }

  async claimBatch(workerId: string, requestedLimit = this.maxBatchSize): Promise<ClaimedOutboxEvent[]> {
    if (typeof workerId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(workerId)) {
      throw new Error("Invalid outbox worker ID");
    }
    if (!Number.isSafeInteger(requestedLimit) || requestedLimit < 1 ||
        requestedLimit > this.maxBatchSize) throw new Error("Invalid outbox batch limit");

    const result = await this.sql.query<{
      event_id: string;
      event_type: string;
      producer_module: string;
      event_data: TlceEvent;
      attempts: number;
    }>(
      `WITH candidates AS (
         SELECT event_id FROM tlce_event_outbox
         WHERE (status = 'pending' AND available_at <= CURRENT_TIMESTAMP)
            OR (status = 'in_progress' AND lease_until <= CURRENT_TIMESTAMP)
         ORDER BY created_at, event_id
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE tlce_event_outbox AS outbox
       SET status = 'in_progress',
           lease_owner = $2,
           lease_until = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'),
           attempts = outbox.attempts + 1,
           updated_at = CURRENT_TIMESTAMP
       FROM candidates
       WHERE outbox.event_id = candidates.event_id
       RETURNING outbox.event_id, outbox.event_type, outbox.producer_module,
                 outbox.event_data, outbox.attempts`,
      [requestedLimit, workerId, this.leaseDurationMs],
    );

    return result.rows.map((row) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      producerModule: row.producer_module,
      eventData: row.event_data,
      leaseOwner: workerId,
      attempts: row.attempts,
    }));
  }

  async renewLease(eventId: string, workerId: string): Promise<boolean> {
    const result = await this.sql.query(
      `UPDATE tlce_event_outbox
       SET lease_until = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'),
           updated_at = CURRENT_TIMESTAMP
       WHERE event_id = $1 AND status = 'in_progress' AND lease_owner = $2
         AND lease_until > CURRENT_TIMESTAMP`,
      [eventId, workerId, this.leaseDurationMs],
    );
    return result.rowCount === 1;
  }

  async markPublished(eventId: string, workerId: string): Promise<void> {
    const result = await this.sql.query(
      `UPDATE tlce_event_outbox
       SET status = 'published', lease_owner = NULL, lease_until = NULL,
           published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE event_id = $1 AND status = 'in_progress' AND lease_owner = $2`,
      [eventId, workerId],
    );
    if (result.rowCount !== 1) throw new Error("Outbox publish acknowledgement lost its lease");
  }

  async release(eventId: string, workerId: string, reason: string, retryDelayMs = 1_000): Promise<void> {
    if (!Number.isSafeInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 3_600_000) {
      throw new Error("Invalid outbox retry delay");
    }
    const result = await this.sql.query(
      `UPDATE tlce_event_outbox
       SET status = 'pending', lease_owner = NULL, lease_until = NULL,
           available_at = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 millisecond'),
           last_error = $4, updated_at = CURRENT_TIMESTAMP
       WHERE event_id = $1 AND status = 'in_progress' AND lease_owner = $2`,
      [eventId, workerId, retryDelayMs, String(reason).slice(0, 500)],
    );
    if (result.rowCount !== 1) throw new Error("Outbox release rejected because the worker does not own the lease");
  }
}

function validateOutboxEvent(event: TlceEvent): void {
  if (!event || typeof event !== "object" ||
      typeof event.eventId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(event.eventId) ||
      typeof event.eventType !== "string" || !/^[a-z][a-z0-9]*(?:[.:-][a-z0-9]+)*$/.test(event.eventType) ||
      !Number.isSafeInteger(event.schemaVersion) || event.schemaVersion < 1 ||
      typeof event.occurredAt !== "string" || Number.isNaN(Date.parse(event.occurredAt)) ||
      typeof event.producerModule !== "string" || !event.producerModule.trim() ||
      typeof event.idempotencyKey !== "string" || !event.idempotencyKey.trim() ||
      !event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    throw new Error("Invalid TLCE outbox event");
  }
}

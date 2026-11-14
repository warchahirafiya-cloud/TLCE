import type { EventConsumer, TlceEvent } from "../contracts/events.js";
import { IdempotentEventProcessor, type EventProcessResult } from "./event-processor.js";
import type { ClaimedOutboxEvent } from "./postgres-event-outbox.js";

export interface OutboxDispatchQueue {
  claimBatch(workerId: string, requestedLimit?: number): Promise<ClaimedOutboxEvent[]>;
  renewLease(eventId: string, workerId: string): Promise<boolean>;
  markPublished(eventId: string, workerId: string): Promise<void>;
  release(eventId: string, workerId: string, reason: string, retryDelayMs?: number): Promise<void>;
}

export interface OutboxDispatcherOptions {
  batchSize?: number;
  heartbeatMs?: number;
  retryDelayMs?: number;
}

export type OutboxDispatchStatus = EventProcessResult | "released" | "lease_lost";
export interface OutboxDispatchReport {
  claimed: number;
  outcomes: Array<{ eventId: string; status: OutboxDispatchStatus }>;
}

/**
 * Bridges the PostgreSQL outbox to the idempotent event processor.
 * A heartbeat keeps a live worker lease while consumer execution/retries run.
 */
export class OutboxEventDispatcher {
  private readonly batchSize: number;
  private readonly heartbeatMs: number;
  private readonly retryDelayMs: number;

  constructor(
    private readonly queue: OutboxDispatchQueue,
    private readonly processor: IdempotentEventProcessor,
    private readonly consumer: EventConsumer<Record<string, unknown>>,
    private readonly workerId: string,
    options: OutboxDispatcherOptions = {},
  ) {
    this.batchSize = options.batchSize ?? 20;
    this.heartbeatMs = options.heartbeatMs ?? 10_000;
    this.retryDelayMs = options.retryDelayMs ?? 1_000;
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(workerId)) throw new Error("Invalid dispatcher worker ID");
    if (!Number.isSafeInteger(this.batchSize) || this.batchSize < 1 || this.batchSize > 1_000 ||
        !Number.isSafeInteger(this.heartbeatMs) || this.heartbeatMs < 100 ||
        !Number.isSafeInteger(this.retryDelayMs) || this.retryDelayMs < 0 || this.retryDelayMs > 3_600_000) {
      throw new Error("Invalid outbox dispatcher configuration");
    }
  }

  async dispatchOnce(): Promise<OutboxDispatchReport> {
    const batch = await this.queue.claimBatch(this.workerId, this.batchSize);
    const outcomes = await Promise.all(batch.map((item) => this.dispatchClaimed(item)));
    return { claimed: batch.length, outcomes };
  }

  private async dispatchClaimed(item: ClaimedOutboxEvent): Promise<{ eventId: string; status: OutboxDispatchStatus }> {
    let heartbeatRunning = false;
    let leaseLost = false;
    let heartbeatError: unknown;
    const heartbeat = setInterval(async () => {
      if (heartbeatRunning || leaseLost) return;
      heartbeatRunning = true;
      try {
        const renewed = await this.queue.renewLease(item.eventId, this.workerId);
        if (!renewed) leaseLost = true;
      } catch (error) {
        heartbeatError = error;
        leaseLost = true;
      } finally {
        heartbeatRunning = false;
      }
    }, this.heartbeatMs);

    try {
      const result = await this.processor.process(
        item.eventData as TlceEvent<Record<string, unknown>>,
        this.consumer,
      );
      if (leaseLost) throw new Error(heartbeatError instanceof Error
        ? heartbeatError.message : "Outbox worker lease was lost during processing");
      if (result === "in_progress") {
        await this.queue.release(item.eventId, this.workerId, "Event is already being processed", this.retryDelayMs);
        return { eventId: item.eventId, status: "released" };
      }
      await this.queue.markPublished(item.eventId, this.workerId);
      return { eventId: item.eventId, status: result };
    } catch (error) {
      try {
        await this.queue.release(
          item.eventId, this.workerId,
          error instanceof Error ? error.message : "Unknown dispatcher failure",
          this.retryDelayMs,
        );
        return { eventId: item.eventId, status: "released" };
      } catch {
        return { eventId: item.eventId, status: "lease_lost" };
      }
    } finally {
      clearInterval(heartbeat);
    }
  }
}

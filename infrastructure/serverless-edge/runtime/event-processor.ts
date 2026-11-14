import type { TlceEvent, EventConsumer } from "./events";

export type EventClaimResult = "claimed" | "completed" | "in_progress";

/**
 * Implementations MUST make claim atomic and durable across processes/instances.
 * The in-memory test adapter is not suitable for production.
 */
export interface EventDeduplicationStore {
  claim(key: string): Promise<EventClaimResult>;
  markCompleted(key: string): Promise<void>;
  release(key: string): Promise<void>;
}

export interface DeadLetterSink {
  record<TPayload extends Record<string, unknown>>(
    event: TlceEvent<TPayload>,
    failure: { attempts: number; reason: string; failedAt: string },
  ): Promise<void>;
}

export interface EventProcessorOptions {
  maxAttempts?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => Date;
}

export type EventProcessResult = "processed" | "duplicate" | "in_progress" | "dead_lettered";

function validateEvent<TPayload extends Record<string, unknown>>(event: TlceEvent<TPayload>): void {
  if (!event || typeof event !== "object" ||
      typeof event.eventId !== "string" || !event.eventId.trim() ||
      typeof event.eventType !== "string" || !/^[a-z][a-z0-9]*(?:[.:-][a-z0-9]+)*$/.test(event.eventType) ||
      !Number.isSafeInteger(event.schemaVersion) || event.schemaVersion < 1 ||
      typeof event.occurredAt !== "string" || Number.isNaN(Date.parse(event.occurredAt)) ||
      typeof event.producerModule !== "string" || !event.producerModule.trim() ||
      typeof event.idempotencyKey !== "string" || !event.idempotencyKey.trim() ||
      !event.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    throw new Error("Invalid TLCE event envelope");
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : "Unknown event handler failure";
}

export class IdempotentEventProcessor {
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly now: () => Date;

  constructor(
    private readonly store: EventDeduplicationStore,
    private readonly deadLetters: DeadLetterSink,
    options: EventProcessorOptions = {},
  ) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 100;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.now = options.now ?? (() => new Date());
    if (!Number.isSafeInteger(this.maxAttempts) || this.maxAttempts < 1 || this.maxAttempts > 10) {
      throw new Error("maxAttempts must be an integer between 1 and 10");
    }
    if (!Number.isSafeInteger(this.retryDelayMs) || this.retryDelayMs < 0 || this.retryDelayMs > 60_000) {
      throw new Error("retryDelayMs must be an integer between 0 and 60000");
    }
  }

  async process<TPayload extends Record<string, unknown>>(
    event: TlceEvent<TPayload>,
    consumer: EventConsumer<TPayload>,
  ): Promise<EventProcessResult> {
    validateEvent(event);
    const key = `${event.producerModule}:${event.eventType}:${event.idempotencyKey}`;
    const claim = await this.store.claim(key);
    if (claim === "completed") return "duplicate";
    if (claim === "in_progress") return "in_progress";
    if (claim !== "claimed") throw new Error("Deduplication store returned an invalid claim result");

    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        await consumer.handle(event);
        await this.store.markCompleted(key);
        return "processed";
      } catch (error) {
        lastError = error;
        if (attempt < this.maxAttempts) {
          await this.sleep(this.retryDelayMs * 2 ** (attempt - 1));
        }
      }
    }

    try {
      await this.deadLetters.record(event, {
        attempts: this.maxAttempts,
        reason: errorMessage(lastError),
        failedAt: this.now().toISOString(),
      });
      await this.store.markCompleted(key);
      return "dead_lettered";
    } catch (deadLetterError) {
      // Do not mark complete when dead-letter persistence failed; allow a safe redelivery.
      await this.store.release(key);
      throw deadLetterError;
    }
  }
}

/** Provider-neutral event contract. Delivery is at-least-once; consumers must be idempotent. */
export interface TlceEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  occurredAt: string;
  producerModule: string;
  idempotencyKey: string;
  payload: TPayload;
}

export interface EventPublishOptions {
  /** Optional logical partition; do not place secrets or personal data here. */
  partitionKey?: string;
}

export interface EventPublisher {
  publish<TPayload extends Record<string, unknown>>(
    event: TlceEvent<TPayload>,
    options?: EventPublishOptions,
  ): Promise<void>;
}

export interface EventConsumer<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  handle(event: TlceEvent<TPayload>): Promise<void>;
}

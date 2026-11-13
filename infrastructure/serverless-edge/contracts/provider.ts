/**
 * Provider-neutral contracts for TLCE's shared serverless and edge layer.
 * Vendor SDKs and provider-specific types must not leak through these interfaces.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface RequestContext {
  requestId: string;
  moduleId: string;
  moduleVersion: string;
  receivedAt: string;
  traceId?: string;
}

export interface FunctionInvocation<TInput extends JsonValue = JsonValue> {
  context: RequestContext;
  input: TInput;
}

export interface FunctionResult<TOutput extends JsonValue = JsonValue> {
  status: "ok" | "accepted";
  output?: TOutput;
  requestId: string;
}

export interface ServerlessFunctionAdapter {
  invoke<TInput extends JsonValue, TOutput extends JsonValue>(
    name: string,
    invocation: FunctionInvocation<TInput>,
  ): Promise<FunctionResult<TOutput>>;
}

export interface CachePolicy {
  ttlSeconds: number;
  namespace: string;
  tags?: string[];
}

export interface DistributedCacheAdapter {
  get<T extends JsonValue>(key: string, namespace: string): Promise<T | null>;
  set<T extends JsonValue>(key: string, value: T, policy: CachePolicy): Promise<void>;
  delete(key: string, namespace: string): Promise<void>;
}

export interface EventEnvelope<TPayload extends JsonValue = JsonValue> {
  eventId: string;
  eventType: string;
  schemaVersion: number;
  occurredAt: string;
  producerModule: string;
  idempotencyKey: string;
  payload: TPayload;
}

export interface EventPublisherAdapter {
  publish<TPayload extends JsonValue>(event: EventEnvelope<TPayload>): Promise<void>;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  checkedAt: string;
  details?: Record<string, string>;
}

export interface HealthCheckAdapter {
  check(): Promise<HealthStatus>;
}

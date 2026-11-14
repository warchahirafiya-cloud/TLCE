# QuestPulse Task Worker

QuestPulse is an internal module of The Last Cosmic Explosion (TLCE). This worker consumes only version-1 `questpulse.task.requested` events produced by the AI Core Bridge.

## Execution boundary
- `QuestPulseTaskWorker` implements the shared `EventConsumer` contract and is intended to be called through `IdempotentEventProcessor`.
- The provider-neutral `AiTaskExecutor` is dependency-injected. No provider SDK, API key, model name, or network endpoint is hardcoded.
- `PostgresQuestPulseTaskResultSink` stores results with first-write-wins uniqueness on `taskId`; a retry cannot overwrite the first persisted result. Event delivery and processing are at-least-once, so executor side effects must also be idempotent.
- Input and output are JSON-object bounded. Defaults are 16 KiB input, 32 KiB output, and 30 seconds execution timeout.
- The timeout aborts the supplied `AbortSignal`. An executor must honor cancellation; JavaScript cannot forcibly terminate an in-process provider call that ignores it.
- Invalid schema, unsupported producers, provider errors, timeout, and persistence failures are surfaced to the event processor for bounded retry and eventual dead-letter handling.

## Wiring
1. Inject the durable PostgreSQL event deduplication store and dead-letter sink into `IdempotentEventProcessor`.
2. Inject a trusted provider adapter implementing `AiTaskExecutor`.
3. Inject `PostgresQuestPulseTaskResultSink` with the same trusted SQL pool used by the deployment and apply migration `003_questpulse_task_results.sql`.
4. Register the worker with the outbox dispatcher/consumer transport and route matching events through the processor.
5. Size event claim leases above the maximum execution window or implement lease renewal in the dispatcher. Ensure the result sink and any provider-side action are idempotent.

## Not yet production-enabled
This change adds contracts, in-process dispatch/worker adapters, and a PostgreSQL result-sink adapter. It does not configure an AI provider, provision credentials, deploy a consumer process, connect a result database, or operate a broker. A hardened process/container sandbox, provider-specific quotas, persistent task state, lease renewal, observability, and operational runbooks remain deployment gates.

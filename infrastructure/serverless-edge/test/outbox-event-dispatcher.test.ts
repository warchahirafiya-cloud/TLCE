import test from "node:test";
import assert from "node:assert/strict";
import type { TlceEvent } from "../contracts/events.js";
import { IdempotentEventProcessor, type EventDeduplicationStore, type EventClaimResult } from "../runtime/event-processor.js";
import { OutboxEventDispatcher, type OutboxDispatchQueue } from "../runtime/outbox-event-dispatcher.js";
import { QuestPulseTaskWorker } from "../runtime/questpulse-task-worker.js";
import type { ClaimedOutboxEvent } from "../runtime/postgres-event-outbox.js";

class MemoryStore implements EventDeduplicationStore {
  values = new Map<string, "in_progress" | "completed">();
  async claim(key: string): Promise<EventClaimResult> {
    const state = this.values.get(key);
    if (state === "completed") return "completed";
    if (state === "in_progress") return "in_progress";
    this.values.set(key, "in_progress");
    return "claimed";
  }
  async markCompleted(key: string) { this.values.set(key, "completed"); }
  async release(key: string) { this.values.delete(key); }
}

class FakeQueue implements OutboxDispatchQueue {
  items: ClaimedOutboxEvent[] = [];
  published: string[] = [];
  released: string[] = [];
  renewals = 0;
  renewResult = true;
  async claimBatch() { return this.items; }
  async renewLease() { this.renewals += 1; return this.renewResult; }
  async markPublished(id: string) { this.published.push(id); }
  async release(id: string) { this.released.push(id); }
}

const event: TlceEvent<{ taskId: string; action: "process"; input: Record<string, unknown> }> = {
  eventId: "evt-dispatch-1", eventType: "questpulse.task.requested", schemaVersion: 1,
  occurredAt: "2026-11-14T10:00:00.000Z", producerModule: "tlce-ai-core-bridge",
  idempotencyKey: "delivery-dispatch-1",
  payload: { taskId: "task-dispatch-1", action: "process", input: { prompt: "hello" } },
};

function claimed(eventData: TlceEvent = event): ClaimedOutboxEvent {
  return {
    eventId: eventData.eventId, eventType: eventData.eventType,
    producerModule: eventData.producerModule, eventData,
    leaseOwner: "worker-1", attempts: 1,
  };
}

function makeProcessor(store = new MemoryStore()) {
  return new IdempotentEventProcessor(store, { async record() {} }, {
    maxAttempts: 1, retryDelayMs: 0, sleep: async () => {},
  });
}

test("dispatches claimed QuestPulse events through processor and acknowledges", async () => {
  const queue = new FakeQueue();
  queue.items = [claimed()];
  const saved: string[] = [];
  const consumer = new QuestPulseTaskWorker({
    executor: { async execute() { return { ok: true }; } },
    results: { async save(taskId) { saved.push(taskId); } },
  });
  const dispatcher = new OutboxEventDispatcher(
    queue, makeProcessor(), consumer as never, "worker-1", { heartbeatMs: 60_000 },
  );
  const report = await dispatcher.dispatchOnce();
  assert.equal(report.claimed, 1);
  assert.deepEqual(report.outcomes, [{ eventId: event.eventId, status: "processed" }]);
  assert.deepEqual(saved, ["task-dispatch-1"]);
  assert.deepEqual(queue.published, [event.eventId]);
  assert.deepEqual(queue.released, []);
});

test("acknowledges an already-completed duplicate without re-running consumer", async () => {
  const store = new MemoryStore();
  await store.claim("tlce-ai-core-bridge:questpulse.task.requested:delivery-dispatch-1");
  await store.markCompleted("tlce-ai-core-bridge:questpulse.task.requested:delivery-dispatch-1");
  const queue = new FakeQueue();
  queue.items = [claimed()];
  let calls = 0;
  const dispatcher = new OutboxEventDispatcher(
    queue, makeProcessor(store),
    { async handle() { calls += 1; } }, "worker-1", { heartbeatMs: 60_000 },
  );
  const report = await dispatcher.dispatchOnce();
  assert.equal(report.outcomes[0].status, "duplicate");
  assert.equal(calls, 0);
  assert.deepEqual(queue.published, [event.eventId]);
});

test("releases events when the processor cannot persist a dead letter", async () => {
  const queue = new FakeQueue();
  queue.items = [claimed({ ...event, payload: { taskId: "invalid" } })];
  const processor = new IdempotentEventProcessor(new MemoryStore(), {
    async record() { throw new Error("dead-letter database unavailable"); },
  }, { maxAttempts: 1, retryDelayMs: 0, sleep: async () => {} });
  const dispatcher = new OutboxEventDispatcher(
    queue, processor, { async handle() { throw new Error("poison event"); } },
    "worker-1", { heartbeatMs: 60_000 },
  );
  const report = await dispatcher.dispatchOnce();
  assert.equal(report.outcomes[0].status, "released");
  assert.deepEqual(queue.released, [event.eventId]);
  assert.deepEqual(queue.published, []);
});

test("reports lost lease when ownership is rejected during release", async () => {
  const queue = new FakeQueue();
  queue.items = [claimed()];
  queue.renewResult = false;
  queue.release = async () => { throw new Error("lease lost"); };
  const dispatcher = new OutboxEventDispatcher(
    queue, makeProcessor(), { async handle() { throw new Error("handler failure"); } },
    "worker-1", { heartbeatMs: 100 },
  );
  const report = await dispatcher.dispatchOnce();
  assert.ok(["released", "lease_lost"].includes(report.outcomes[0].status));
});

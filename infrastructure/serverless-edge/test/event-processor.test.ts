import test from "node:test";
import assert from "node:assert/strict";
import { IdempotentEventProcessor, type EventDeduplicationStore, type EventClaimResult } from "../runtime/event-processor.js";
import type { TlceEvent, EventConsumer } from "../contracts/events.js";

class MemoryStore implements EventDeduplicationStore {
  readonly values = new Map<string, "in_progress" | "completed">();
  async claim(key: string): Promise<EventClaimResult> {
    const value = this.values.get(key);
    if (value === "completed") return "completed";
    if (value === "in_progress") return "in_progress";
    this.values.set(key, "in_progress");
    return "claimed";
  }
  async markCompleted(key: string) { this.values.set(key, "completed"); }
  async release(key: string) { this.values.delete(key); }
}

const event: TlceEvent<{ userId: string }> = {
  eventId: "evt-1", eventType: "profile.updated", schemaVersion: 1,
  occurredAt: "2026-11-14T00:00:00.000Z", producerModule: "quest-pulse",
  idempotencyKey: "profile-1-v1", payload: { userId: "user-1" },
};

test("processes an event once and ignores completed duplicates", async () => {
  const store = new MemoryStore();
  let calls = 0;
  const consumer: EventConsumer<{ userId: string }> = { async handle() { calls += 1; } };
  const processor = new IdempotentEventProcessor(store, { async record() {} });
  assert.equal(await processor.process(event, consumer), "processed");
  assert.equal(await processor.process(event, consumer), "duplicate");
  assert.equal(calls, 1);
});

test("reports an in-progress duplicate without invoking the consumer", async () => {
  const store = new MemoryStore();
  await store.claim("quest-pulse:profile.updated:profile-1-v1");
  const processor = new IdempotentEventProcessor(store, { async record() {} });
  let calls = 0;
  assert.equal(await processor.process(event, { async handle() { calls += 1; } }), "in_progress");
  assert.equal(calls, 0);
});

test("retries with bounded exponential delays", async () => {
  const store = new MemoryStore();
  const delays: number[] = [];
  let calls = 0;
  const processor = new IdempotentEventProcessor(store, { async record() {} }, {
    maxAttempts: 3, retryDelayMs: 10,
    sleep: async (delay) => { delays.push(delay); },
  });
  const result = await processor.process(event, {
    async handle() { calls += 1; if (calls < 3) throw new Error("temporary"); },
  });
  assert.equal(result, "processed");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("sends exhausted events to dead-letter sink", async () => {
  const store = new MemoryStore();
  let recorded = 0;
  const processor = new IdempotentEventProcessor(store, {
    async record(received, failure) {
      recorded += 1;
      assert.equal(received.eventId, event.eventId);
      assert.equal(failure.attempts, 2);
    },
  }, { maxAttempts: 2, retryDelayMs: 0, sleep: async () => {} });
  const result = await processor.process(event, { async handle() { throw new Error("permanent"); } });
  assert.equal(result, "dead_lettered");
  assert.equal(recorded, 1);
  assert.equal(await store.claim("quest-pulse:profile.updated:profile-1-v1"), "completed");
});

test("releases a claim if dead-letter persistence fails", async () => {
  const store = new MemoryStore();
  const processor = new IdempotentEventProcessor(store, {
    async record() { throw new Error("sink unavailable"); },
  }, { maxAttempts: 1 });
  await assert.rejects(
    () => processor.process(event, { async handle() { throw new Error("handler failed"); } }),
    /sink unavailable/,
  );
  assert.equal(store.values.size, 0);
});

test("rejects malformed event envelopes before claiming", async () => {
  const store = new MemoryStore();
  const processor = new IdempotentEventProcessor(store, { async record() {} });
  await assert.rejects(
    () => processor.process({ ...event, schemaVersion: 0 }, { async handle() {} }),
    /Invalid TLCE event envelope/,
  );
  assert.equal(store.values.size, 0);
});

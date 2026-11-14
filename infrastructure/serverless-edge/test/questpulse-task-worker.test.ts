import test from "node:test";
import assert from "node:assert/strict";
import { QuestPulseTaskWorker, type AiTaskExecutor } from "../runtime/questpulse-task-worker.js";
import type { TlceEvent } from "../contracts/events.js";

const event: TlceEvent<{ taskId: string; action: "process"; input: Record<string, unknown> }> = {
  eventId: "evt-task-1",
  eventType: "questpulse.task.requested",
  schemaVersion: 1,
  occurredAt: "2026-11-14T10:00:00.000Z",
  producerModule: "tlce-ai-core-bridge",
  idempotencyKey: "delivery-1",
  payload: { taskId: "task-1", action: "process", input: { prompt: "summarize" } },
};

test("executes a valid task and persists its result by task ID", async () => {
  const saved: unknown[] = [];
  const worker = new QuestPulseTaskWorker({
    executor: { async execute(task) { return { answer: task.input.prompt }; } },
    results: { async save(taskId, result) { saved.push({ taskId, result }); } },
  });
  await worker.handle(event);
  assert.deepEqual(saved, [{ taskId: "task-1", result: { answer: "summarize" } }]);
});

test("rejects unsupported event versions and producers", async () => {
  const worker = new QuestPulseTaskWorker({
    executor: { async execute() { return {}; } },
    results: { async save() {} },
  });
  await assert.rejects(() => worker.handle({ ...event, schemaVersion: 2 }), /Unsupported/);
  await assert.rejects(() => worker.handle({ ...event, producerModule: "unknown" }), /Unsupported/);
});

test("rejects malformed and oversized task payloads before provider execution", async () => {
  let calls = 0;
  const executor: AiTaskExecutor = { async execute() { calls += 1; return {}; } };
  const worker = new QuestPulseTaskWorker({
    executor, results: { async save() {} }, maxInputBytes: 128,
  });
  await assert.rejects(() => worker.handle({ ...event, payload: { ...event.payload, action: "delete" } as never }), /Invalid/);
  await assert.rejects(() => worker.handle({
    ...event, payload: { ...event.payload, input: { prompt: "x".repeat(256) } },
  }), /exceeds/);
  assert.equal(calls, 0);
});

test("aborts and rejects execution after its deadline", async () => {
  let aborted = false;
  const worker = new QuestPulseTaskWorker({
    timeoutMs: 100,
    executor: {
      async execute(_task, signal) {
        return new Promise((resolve) => {
          signal.addEventListener("abort", () => { aborted = true; resolve({ late: true }); });
        });
      },
    },
    results: { async save() {} },
  });
  await assert.rejects(() => worker.handle(event), /timed out/);
  assert.equal(aborted, true);
});

test("rejects non-object and oversized results", async () => {
  const scalarWorker = new QuestPulseTaskWorker({
    executor: { async execute() { return "not-an-object"; } },
    results: { async save() {} },
  });
  await assert.rejects(() => scalarWorker.handle(event), /JSON object/);

  const largeWorker = new QuestPulseTaskWorker({
    executor: { async execute() { return { data: "x".repeat(256) }; } },
    results: { async save() {} }, maxOutputBytes: 128,
  });
  await assert.rejects(() => largeWorker.handle(event), /exceeds/);
});

test("propagates result persistence errors so event processing can retry", async () => {
  const worker = new QuestPulseTaskWorker({
    executor: { async execute() { return { ok: true }; } },
    results: { async save() { throw new Error("result store unavailable"); } },
  });
  await assert.rejects(() => worker.handle(event), /result store unavailable/);
});

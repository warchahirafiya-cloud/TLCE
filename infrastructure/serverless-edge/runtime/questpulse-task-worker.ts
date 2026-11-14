import type { EventConsumer, TlceEvent } from "../contracts/events.js";

export interface QuestPulseTaskPayload extends Record<string, unknown> {
  taskId: string;
  action: "process";
  input: Record<string, unknown>;
}

export interface AiTaskExecutor {
  execute(task: { taskId: string; input: Record<string, unknown> }, signal: AbortSignal): Promise<unknown>;
}

export interface QuestPulseTaskResultSink {
  /** Must upsert by taskId so retries cannot create duplicate results. */
  save(taskId: string, result: Record<string, unknown>): Promise<void>;
}

export interface QuestPulseTaskWorkerOptions {
  executor: AiTaskExecutor;
  results: QuestPulseTaskResultSink;
  timeoutMs?: number;
  maxInputBytes?: number;
  maxOutputBytes?: number;
}

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validatePayload(payload: unknown, maxInputBytes: number): asserts payload is QuestPulseTaskPayload {
  if (!isRecord(payload) ||
      Object.keys(payload).some((key) => !["taskId", "action", "input"].includes(key)) ||
      Object.keys(payload).length !== 3 ||
      typeof payload.taskId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(payload.taskId) ||
      payload.action !== "process" || !isRecord(payload.input)) {
    throw new Error("Invalid QuestPulse task payload");
  }
  let size: number;
  try { size = byteLength(payload.input); } catch { throw new Error("QuestPulse input must be JSON-serializable"); }
  if (size > maxInputBytes) throw new Error("QuestPulse task input exceeds the configured limit");
}

export class QuestPulseTaskWorker implements EventConsumer<QuestPulseTaskPayload> {
  private readonly timeoutMs: number;
  private readonly maxInputBytes: number;
  private readonly maxOutputBytes: number;

  constructor(private readonly options: QuestPulseTaskWorkerOptions) {
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxInputBytes = options.maxInputBytes ?? 16_384;
    this.maxOutputBytes = options.maxOutputBytes ?? 32_768;
    if (!options.executor || typeof options.executor.execute !== "function" ||
        !options.results || typeof options.results.save !== "function") {
      throw new Error("QuestPulse worker requires an executor and result sink");
    }
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 300_000 ||
        !Number.isSafeInteger(this.maxInputBytes) || this.maxInputBytes < 128 || this.maxInputBytes > 65_536 ||
        !Number.isSafeInteger(this.maxOutputBytes) || this.maxOutputBytes < 128 || this.maxOutputBytes > 131_072) {
      throw new Error("Invalid QuestPulse worker limits");
    }
  }

  async handle(event: TlceEvent<QuestPulseTaskPayload>): Promise<void> {
    if (event.eventType !== "questpulse.task.requested" || event.schemaVersion !== 1 ||
        event.producerModule !== "tlce-ai-core-bridge") {
      throw new Error("Unsupported QuestPulse task event");
    }
    validatePayload(event.payload, this.maxInputBytes);

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const execution = this.options.executor.execute(
        { taskId: event.payload.taskId, input: event.payload.input },
        controller.signal,
      );
      const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error("AI task execution timed out"));
        }, this.timeoutMs);
      });
      const rawResult = await Promise.race([execution, deadline]);
      if (!isRecord(rawResult)) throw new Error("AI task executor must return a JSON object");
      let outputSize: number;
      try { outputSize = byteLength(rawResult); } catch { throw new Error("AI task result must be JSON-serializable"); }
      if (outputSize > this.maxOutputBytes) throw new Error("AI task result exceeds the configured limit");
      await this.options.results.save(event.payload.taskId, rawResult);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }
}

import type { QuestPulseTaskResultSink } from "./questpulse-task-worker.js";
import type { SqlExecutor } from "./postgres-event-store.js";

export interface PostgresTaskResultSinkOptions {
  maxResultBytes?: number;
}

/** Durable first-write-wins result storage. A retry cannot overwrite a completed task result. */
export class PostgresQuestPulseTaskResultSink implements QuestPulseTaskResultSink {
  private readonly maxResultBytes: number;

  constructor(private readonly sql: SqlExecutor, options: PostgresTaskResultSinkOptions = {}) {
    this.maxResultBytes = options.maxResultBytes ?? 32_768;
    if (!sql || typeof sql.query !== "function") throw new Error("Task result sink requires a SQL executor");
    if (!Number.isSafeInteger(this.maxResultBytes) || this.maxResultBytes < 128 ||
        this.maxResultBytes > 131_072) throw new Error("Invalid task result size limit");
  }

  async save(taskId: string, result: Record<string, unknown>): Promise<void> {
    if (typeof taskId !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(taskId)) {
      throw new Error("Invalid QuestPulse task ID");
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error("QuestPulse result must be a JSON object");
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(result);
      if (typeof serialized !== "string") throw new Error("not serializable");
    } catch {
      throw new Error("QuestPulse result must be JSON-serializable");
    }
    if (new TextEncoder().encode(serialized).byteLength > this.maxResultBytes) {
      throw new Error("QuestPulse result exceeds the configured limit");
    }
    await this.sql.query(
      `INSERT INTO tlce_questpulse_task_results
        (task_id, result_data, created_at)
       VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (task_id) DO NOTHING`,
      [taskId, serialized],
    );
  }
}

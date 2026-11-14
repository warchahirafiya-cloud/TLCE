export type AuditOutcome = "success" | "denied" | "failure";

export interface McpAuditEvent {
  readonly event: "mcp.tool.invoked";
  readonly timestamp: string;
  readonly tool: string;
  readonly principalId: string;
  readonly outcome: AuditOutcome;
  readonly durationMs: number;
  readonly correlationId: string;
}

export interface AuditSink {
  /** True only when writes are durably persisted under the TLCE Core retention/access policy. */
  readonly durable: boolean;
  write(event: McpAuditEvent): Promise<void>;
}

/** Development-only metadata sink. Never use this sink in production. */
export const stdoutAuditSink: AuditSink = {
  durable: false,
  async write(event): Promise<void> {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
};

/** Prevents accidental production startup with a process-local/non-durable audit adapter. */
export function assertProductionAuditSink(sink: AuditSink, nodeEnv: string): void {
  if (nodeEnv === "production" && sink.durable !== true) {
    throw new Error("Production startup requires a durable TLCE Core audit sink");
  }
}

export function createAuditEvent(input: Omit<McpAuditEvent, "event" | "timestamp">): McpAuditEvent {
  return Object.freeze({
    event: "mcp.tool.invoked",
    timestamp: new Date().toISOString(),
    ...input
  });
}

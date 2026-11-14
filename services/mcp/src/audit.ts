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
  write(event: McpAuditEvent): Promise<void>;
}

/** Safe baseline sink: emits metadata only; replace with TLCE Core's durable audit adapter. */
export const stdoutAuditSink: AuditSink = {
  async write(event): Promise<void> {
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }
};

export function createAuditEvent(input: Omit<McpAuditEvent, "event" | "timestamp">): McpAuditEvent {
  return Object.freeze({
    event: "mcp.tool.invoked",
    timestamp: new Date().toISOString(),
    ...input
  });
}

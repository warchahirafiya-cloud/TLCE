export type AuditOutcome = "success" | "denied" | "failure";

export interface AuditRecord {
  readonly auditId: string;
  readonly occurredAt: string;
  readonly requestId: string;
  readonly actorId: string;
  readonly actorType: "user" | "service" | "module" | "system";
  readonly moduleId: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string;
  readonly outcome: AuditOutcome;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface AuditSink {
  write(record: AuditRecord): Promise<void>;
}

export interface AuditRecordInput extends Omit<AuditRecord, "metadata"> {
  metadata?: Readonly<Record<string, string>>;
}

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/;
const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|cookie|credential|private.?key|api.?key)/i;

function requireIdentifier(value: string, field: string): void {
  if (typeof value !== "string" || !SAFE_IDENTIFIER.test(value)) {
    throw new Error(`Invalid audit ${field}`);
  }
}

/** Construct a bounded, immutable audit record without accepting secret-bearing metadata. */
export function createAuditRecord(input: AuditRecordInput): AuditRecord {
  requireIdentifier(input.auditId, "id");
  requireIdentifier(input.requestId, "request id");
  requireIdentifier(input.actorId, "actor id");
  requireIdentifier(input.moduleId, "module id");
  requireIdentifier(input.action, "action");
  requireIdentifier(input.resourceType, "resource type");
  if (input.resourceId !== undefined) requireIdentifier(input.resourceId, "resource id");
  if (!["user", "service", "module", "system"].includes(input.actorType)) throw new Error("Invalid audit actor type");
  if (!["success", "denied", "failure"].includes(input.outcome)) throw new Error("Invalid audit outcome");
  if (typeof input.occurredAt !== "string" || Number.isNaN(Date.parse(input.occurredAt))) {
    throw new Error("Invalid audit timestamp");
  }

  const metadata: Record<string, string> = {};
  const entries = Object.entries(input.metadata ?? {});
  if (entries.length > 20) throw new Error("Audit metadata exceeds the 20-field limit");
  for (const [key, value] of entries) {
    if (!/^[a-z][a-z0-9_.-]{0,63}$/i.test(key) || SENSITIVE_KEY.test(key)) {
      throw new Error("Audit metadata contains a prohibited key");
    }
    if (typeof value !== "string" || value.length > 256 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
      throw new Error("Audit metadata values must be bounded safe strings");
    }
    metadata[key] = value;
  }

  Object.freeze(metadata);
  return Object.freeze({ ...input, metadata });
}

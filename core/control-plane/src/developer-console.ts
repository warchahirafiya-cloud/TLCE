import { randomUUID } from "node:crypto";
import type { AuditRecord, AuditSink } from "../../audit/src/audit";
import { createAuditRecord } from "../../audit/src/audit";
import { isOperatorAuthorized, type OperatorRole } from "../../identity/src/operator-authorization";

export interface VerifiedOperatorContext {
  /** Stable subject from the server-verified TLCE identity session, never request JSON. */
  readonly subject: string;
  readonly roles: ReadonlyArray<OperatorRole>;
  /** Explicit module scope from the server-side identity/policy store. */
  readonly allowedModuleIds: ReadonlyArray<string>;
}

export interface ConsoleOverview {
  readonly registeredModules: number;
  readonly readyModules: number;
  readonly degradedModules: number;
  readonly failedModules: number;
}

export interface ConsoleModuleSummary {
  readonly moduleId: string;
  readonly displayName: string;
  readonly version: string;
  readonly state: "registered" | "initialized" | "ready" | "degraded" | "stopped" | "failed";
}

export interface ControlPlaneReadModel {
  getOverview(): Promise<ConsoleOverview>;
  listModules(): Promise<ReadonlyArray<ConsoleModuleSummary>>;
}

export interface DeveloperConsoleOptions {
  readonly readModel: ControlPlaneReadModel;
  readonly auditSink: AuditSink;
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export class ConsoleAccessDeniedError extends Error {
  constructor() {
    super("TLCE developer-console access denied");
    this.name = "ConsoleAccessDeniedError";
  }
}

/**
 * Server-side read service for the private TLCE developer console.
 * Pass only an operator context resolved from a verified server session.
 * This service is not an HTTP server or an authentication provider.
 */
export class DeveloperConsoleService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(private readonly options: DeveloperConsoleOptions) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  async getOverview(operator: VerifiedOperatorContext | null, requestId: string): Promise<ConsoleOverview> {
    await this.authorizeAndAudit(operator, requestId, "control-plane.overview", "read");
    return this.options.readModel.getOverview();
  }

  async listModules(operator: VerifiedOperatorContext | null, requestId: string): Promise<ReadonlyArray<ConsoleModuleSummary>> {
    await this.authorizeAndAudit(operator, requestId, "modules.registry", "read");
    const allowed = new Set(operator?.allowedModuleIds ?? []);
    const modules = await this.options.readModel.listModules();
    return modules.filter((module) => allowed.has(module.moduleId));
  }

  private async authorizeAndAudit(
    operator: VerifiedOperatorContext | null,
    requestId: string,
    resource: string,
    action: string,
  ): Promise<void> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(requestId)) throw new Error("Invalid request id");
    const allowed = operator !== null && isOperatorAuthorized({
      roles: operator.roles,
      resource,
      action,
    });

    const record: AuditRecord = createAuditRecord({
      auditId: this.createId(),
      occurredAt: this.now().toISOString(),
      requestId,
      actorId: operator?.subject ?? "anonymous",
      actorType: "user",
      moduleId: "tlce-control-plane",
      action: `console.${resource.replace(/[^A-Za-z0-9._-]/g, ".")}.${action}`,
      resourceType: "control-plane",
      outcome: allowed ? "success" : "denied",
      metadata: { resource, action },
    });

    // Fail closed: do not serve privileged console data if its audit event cannot be persisted.
    await this.options.auditSink.write(record);
    if (!allowed) throw new ConsoleAccessDeniedError();
  }
}

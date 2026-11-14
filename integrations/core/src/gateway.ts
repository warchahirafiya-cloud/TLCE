import { randomUUID } from "node:crypto";
import type {
  IntegrationGrant,
  OperationRequest,
  ProviderDescriptor,
} from "./contracts.js";
import { authorizeIntegrationOperation } from "./policy.js";
import type {
  IntegrationAuditSink,
  ProviderAdapter,
  ProviderOperationContext,
} from "./adapter.js";

export interface IntegrationGatewayRequest extends OperationRequest {
  readonly correlationId: string;
  readonly input: unknown;
}

export interface IntegrationGatewayDependencies {
  getProvider(providerId: string): Promise<ProviderDescriptor | undefined>;
  getGrant(request: IntegrationGatewayRequest): Promise<IntegrationGrant | undefined>;
  getAdapter(providerId: string): Promise<ProviderAdapter | undefined>;
  audit: IntegrationAuditSink;
}

export class IntegrationAuthorizationError extends Error {
  constructor(readonly reason: string) {
    super(`Integration operation denied: ${reason}`);
    this.name = "IntegrationAuthorizationError";
  }
}

/** Single execution path for provider operations; all modules must route through this gateway. */
export class IntegrationGateway {
  constructor(private readonly dependencies: IntegrationGatewayDependencies) {}

  async execute<T = unknown>(request: IntegrationGatewayRequest): Promise<T> {
    const [provider, grant, adapter] = await Promise.all([
      this.dependencies.getProvider(request.providerId),
      this.dependencies.getGrant(request),
      this.dependencies.getAdapter(request.providerId),
    ]);

    const decision = authorizeIntegrationOperation(provider, grant, request);
    const baseAudit = {
      occurredAt: request.now ?? Date.now(),
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      principalId: request.principalId,
      providerId: request.providerId,
      operation: request.operation,
    };

    const writeAudit = (outcome: "allowed" | "denied" | "succeeded" | "failed", reason?: string) =>
      this.dependencies.audit.append({ ...baseAudit, eventId: randomUUID(), outcome, ...(reason ? { reason } : {}) });

    if (!decision.allowed) {
      await writeAudit("denied", decision.reason);
      throw new IntegrationAuthorizationError(decision.reason);
    }
    if (!adapter || adapter.providerId !== request.providerId) {
      await writeAudit("denied", "adapter_unavailable");
      throw new IntegrationAuthorizationError("adapter_unavailable");
    }

    const operation = adapter.operations.find((item) => item.name === request.operation);
    if (!operation || operation.permission !== request.permission ||
        (operation.financial && request.ownerConfirmed !== true)) {
      await writeAudit("denied", "adapter_operation_policy_mismatch");
      throw new IntegrationAuthorizationError("adapter_operation_policy_mismatch");
    }

    await writeAudit("allowed");
    const context: ProviderOperationContext = {
      tenantId: request.tenantId,
      principalId: request.principalId,
      correlationId: request.correlationId,
      resource: request.resource,
    };

    try {
      const result = await adapter.execute(request.operation, request.input, context);
      await writeAudit("succeeded");
      return result as T;
    } catch (error) {
      await writeAudit("failed", error instanceof Error ? error.name : "unknown_error");
      throw error;
    }
  }
}

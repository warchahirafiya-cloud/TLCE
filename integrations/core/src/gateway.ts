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
      eventId: `${request.correlationId}:${request.operation}`,
      occurredAt: request.now ?? Date.now(),
      correlationId: request.correlationId,
      tenantId: request.tenantId,
      principalId: request.principalId,
      providerId: request.providerId,
      operation: request.operation,
    };

    if (!decision.allowed) {
      await this.dependencies.audit.append({
        ...baseAudit,
        outcome: "denied",
        reason: decision.reason,
      });
      throw new IntegrationAuthorizationError(decision.reason);
    }
    if (!adapter || adapter.providerId !== request.providerId) {
      await this.dependencies.audit.append({
        ...baseAudit,
        outcome: "denied",
        reason: "adapter_unavailable",
      });
      throw new IntegrationAuthorizationError("adapter_unavailable");
    }

    const operation = adapter.operations.find((item) => item.name === request.operation);
    if (!operation || operation.permission !== request.permission ||
        (operation.financial && request.ownerConfirmed !== true)) {
      await this.dependencies.audit.append({
        ...baseAudit,
        outcome: "denied",
        reason: "adapter_operation_policy_mismatch",
      });
      throw new IntegrationAuthorizationError("adapter_operation_policy_mismatch");
    }

    await this.dependencies.audit.append({ ...baseAudit, outcome: "allowed" });
    const context: ProviderOperationContext = {
      tenantId: request.tenantId,
      principalId: request.principalId,
      correlationId: request.correlationId,
      resource: request.resource,
    };

    try {
      const result = await adapter.execute(request.operation, request.input, context);
      await this.dependencies.audit.append({ ...baseAudit, outcome: "succeeded" });
      return result as T;
    } catch (error) {
      await this.dependencies.audit.append({
        ...baseAudit,
        outcome: "failed",
        reason: error instanceof Error ? error.name : "unknown_error",
      });
      throw error;
    }
  }
}

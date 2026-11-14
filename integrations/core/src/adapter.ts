import type { PermissionTier, RiskClass } from "./contracts.js";

export interface SecretReference {
  readonly id: string;
  readonly providerId: string;
  readonly tenantId: string;
  readonly createdAt: number;
  readonly expiresAt?: number;
}

export interface SecretVault {
  /** Implementations encrypt secrets at rest and never return them to logs. */
  put(input: {
    providerId: string;
    tenantId: string;
    kind: "oauth-token-set" | "api-key";
    secret: Uint8Array;
    expiresAt?: number;
  }): Promise<SecretReference>;
  /** Resolve only inside a trusted server-side adapter execution boundary. */
  withSecret<T>(reference: SecretReference, use: (secret: Uint8Array) => Promise<T>): Promise<T>;
  revoke(reference: SecretReference): Promise<void>;
}

export interface ProviderOperationContext {
  readonly tenantId: string;
  readonly principalId: string;
  readonly correlationId: string;
  readonly resource: string;
}

export interface ProviderOperation {
  readonly name: string;
  readonly permission: PermissionTier;
  readonly riskClass: RiskClass;
  readonly financial: boolean;
}

export interface ProviderAdapter {
  readonly providerId: string;
  readonly operations: readonly ProviderOperation[];
  healthCheck(context: ProviderOperationContext): Promise<{ healthy: boolean; checkedAt: number }>;
  execute(
    operation: string,
    input: unknown,
    context: ProviderOperationContext,
  ): Promise<unknown>;
}

export interface IntegrationAuditSink {
  append(event: {
    readonly eventId: string;
    readonly occurredAt: number;
    readonly correlationId: string;
    readonly tenantId: string;
    readonly principalId: string;
    readonly providerId: string;
    readonly operation: string;
    readonly outcome: "allowed" | "denied" | "succeeded" | "failed" | "revoked";
    readonly reason?: string;
  }): Promise<void>;
}

export type IntegrationLifecycle =
  | "catalogued"
  | "reviewed"
  | "consent_pending"
  | "connected"
  | "health_checked"
  | "enabled"
  | "disconnected"
  | "revoked";

export type PermissionTier = "read" | "write" | "execute" | "admin" | "financial";
export type RiskClass = "low" | "medium" | "high" | "critical";

export interface ProviderDescriptor {
  readonly id: string;
  readonly name: string;
  readonly origin: string;
  readonly category: string;
  readonly riskClass: RiskClass;
  readonly lifecycle: IntegrationLifecycle;
  readonly connectionVerified: boolean;
  readonly enabledOperations: readonly string[];
}

export interface IntegrationGrant {
  readonly tenantId: string;
  readonly principalId: string;
  readonly providerId: string;
  readonly resourcePatterns: readonly string[];
  readonly permissions: readonly PermissionTier[];
  readonly operations: readonly string[];
  readonly expiresAt?: number;
  readonly revoked?: boolean;
}

export interface OperationRequest {
  readonly tenantId: string;
  readonly principalId: string;
  readonly providerId: string;
  readonly resource: string;
  readonly operation: string;
  readonly permission: PermissionTier;
  readonly now?: number;
  readonly ownerConfirmed?: boolean;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason:
    | "allowed"
    | "provider_not_enabled"
    | "grant_missing"
    | "grant_revoked"
    | "grant_expired"
    | "scope_mismatch"
    | "operation_not_enabled"
    | "owner_confirmation_required";
}

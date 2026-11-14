import type {
  AuthorizationDecision,
  IntegrationGrant,
  OperationRequest,
  ProviderDescriptor,
} from "./contracts.js";

function resourceMatches(patterns: readonly string[], resource: string): boolean {
  return patterns.some((pattern) => {
    if (pattern === "*") return true;
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -1);
      return resource.startsWith(prefix);
    }
    return pattern === resource;
  });
}

export function authorizeIntegrationOperation(
  provider: ProviderDescriptor | undefined,
  grant: IntegrationGrant | undefined,
  request: OperationRequest,
): AuthorizationDecision {
  if (!provider || provider.id !== request.providerId ||
      provider.lifecycle !== "enabled" || !provider.connectionVerified) {
    return { allowed: false, reason: "provider_not_enabled" };
  }
  if (!provider.enabledOperations.includes(request.operation)) {
    return { allowed: false, reason: "operation_not_enabled" };
  }
  if (!grant) return { allowed: false, reason: "grant_missing" };
  if (grant.revoked) return { allowed: false, reason: "grant_revoked" };
  if (grant.expiresAt !== undefined && grant.expiresAt <= (request.now ?? Date.now())) {
    return { allowed: false, reason: "grant_expired" };
  }
  const inScope =
    grant.tenantId === request.tenantId &&
    grant.principalId === request.principalId &&
    grant.providerId === request.providerId &&
    grant.permissions.includes(request.permission) &&
    grant.operations.includes(request.operation) &&
    resourceMatches(grant.resourcePatterns, request.resource);
  if (!inScope) return { allowed: false, reason: "scope_mismatch" };

  if (request.permission === "financial" && request.ownerConfirmed !== true) {
    return { allowed: false, reason: "owner_confirmation_required" };
  }
  return { allowed: true, reason: "allowed" };
}

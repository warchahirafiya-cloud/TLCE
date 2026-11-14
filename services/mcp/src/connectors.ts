/**
 * Provider-neutral connector control plane contracts.
 * This module stores metadata and authorization policy only; secrets and provider tokens
 * must live in an external vault and are referenced by opaque identifiers.
 */
export const CONNECTOR_PROVIDERS = ["google-drive", "salesforce", "slack"] as const;
export type ConnectorProvider = typeof CONNECTOR_PROVIDERS[number];
export type ConnectorStatus = "pending-approval" | "disabled" | "enabled" | "revoked";
export type ConnectorOperation = "read" | "write" | "admin";

export interface ConnectorRegistration {
  readonly id: string;
  readonly provider: ConnectorProvider;
  readonly displayName: string;
  readonly status: ConnectorStatus;
  readonly oauthIssuer: URL;
  readonly clientId: string;
  /** Opaque secret-manager reference; never a credential or token value. */
  readonly clientSecretRef: string;
  readonly redirectUri: URL;
  readonly requestedScopes: readonly string[];
  readonly createdAt: string;
}

export interface ConnectorGrant {
  readonly connectorId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly operations: readonly ConnectorOperation[];
  readonly resourcePatterns: readonly string[];
  readonly expiresAt: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
}

export interface ConnectorInvocation {
  readonly connectorId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly operation: ConnectorOperation;
  readonly resource: string;
  readonly now?: Date;
}

export type ConnectorDecision =
  | { readonly allowed: true; readonly reason: "grant-match" }
  | { readonly allowed: false; readonly reason: "connector-not-found" | "connector-not-enabled" | "grant-not-found" | "grant-expired" | "operation-not-granted" | "resource-not-granted" };

const safeId = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,127}$/;
const safeSecretRef = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{2,255}$/;

export function validateConnectorRegistration(input: ConnectorRegistration): void {
  if (!safeId.test(input.id)) throw new Error("Invalid connector id");
  if (!safeId.test(input.clientId)) throw new Error("Invalid OAuth client id");
  if (!safeSecretRef.test(input.clientSecretRef)) throw new Error("Invalid secret-manager reference");
  if (input.status !== "pending-approval" && input.status !== "disabled") {
    throw new Error("New connectors must start pending approval or disabled");
  }
  if (input.oauthIssuer.protocol !== "https:" || input.redirectUri.protocol !== "https:") {
    throw new Error("Connector OAuth issuer and redirect URI must use HTTPS");
  }
  if (input.requestedScopes.length === 0 || input.requestedScopes.some((scope) => !/^[\x21-\x7E]{1,128}$/.test(scope))) {
    throw new Error("Connector scopes must be explicit printable tokens");
  }
}

function resourceMatches(pattern: string, resource: string): boolean {
  if (pattern === "*") return false; // Wildcard access is deliberately never granted.
  if (!pattern.endsWith("*")) return pattern === resource;
  const prefix = pattern.slice(0, -1);
  return prefix.length > 0 && resource.startsWith(prefix);
}

/** Deny-by-default authorization; every dimension must match one explicit grant. */
export function authorizeConnectorInvocation(
  registrations: readonly ConnectorRegistration[],
  grants: readonly ConnectorGrant[],
  request: ConnectorInvocation
): ConnectorDecision {
  const connector = registrations.find((item) => item.id === request.connectorId);
  if (!connector) return { allowed: false, reason: "connector-not-found" };
  if (connector.status !== "enabled") return { allowed: false, reason: "connector-not-enabled" };

  const grant = grants.find((item) =>
    item.connectorId === request.connectorId &&
    item.tenantId === request.tenantId &&
    item.principalId === request.principalId
  );
  if (!grant) return { allowed: false, reason: "grant-not-found" };

  const expiry = Date.parse(grant.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= (request.now ?? new Date()).getTime()) {
    return { allowed: false, reason: "grant-expired" };
  }
  if (!grant.operations.includes(request.operation)) {
    return { allowed: false, reason: "operation-not-granted" };
  }
  if (!grant.resourcePatterns.some((pattern) => resourceMatches(pattern, request.resource))) {
    return { allowed: false, reason: "resource-not-granted" };
  }
  return { allowed: true, reason: "grant-match" };
}

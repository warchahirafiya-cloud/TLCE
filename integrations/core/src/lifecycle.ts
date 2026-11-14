import type { IntegrationLifecycle } from "./contracts.js";

export interface ConnectionLifecycleRecord {
  readonly providerId: string;
  readonly tenantId: string;
  readonly lifecycle: IntegrationLifecycle;
  readonly connectionVerified: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly revokedAt?: number;
}

const transitions: Readonly<Record<IntegrationLifecycle, readonly IntegrationLifecycle[]>> = {
  catalogued: ["reviewed"],
  reviewed: ["consent_pending", "disconnected"],
  consent_pending: ["connected", "disconnected"],
  connected: ["health_checked", "disconnected", "revoked"],
  health_checked: ["enabled", "disconnected", "revoked"],
  enabled: ["disconnected", "revoked"],
  disconnected: ["reviewed", "consent_pending", "revoked"],
  revoked: [],
};

export function transitionConnectionLifecycle(
  current: ConnectionLifecycleRecord,
  next: IntegrationLifecycle,
  now = Date.now(),
): ConnectionLifecycleRecord {
  if (!transitions[current.lifecycle].includes(next)) {
    throw new Error(`Invalid connection lifecycle transition: ${current.lifecycle} -> ${next}`);
  }
  const connectionVerified = next === "connected" ||
    next === "health_checked" || next === "enabled"
      ? current.connectionVerified || next === "connected"
      : false;
  if ((next === "health_checked" || next === "enabled") && !connectionVerified) {
    throw new Error("A verified provider connection is required");
  }
  if (next === "enabled" && current.lifecycle !== "health_checked") {
    throw new Error("A successful health check is required before enabling");
  }
  return {
    ...current,
    lifecycle: next,
    connectionVerified,
    updatedAt: now,
    ...(next === "revoked" ? { revokedAt: now } : {}),
  };
}

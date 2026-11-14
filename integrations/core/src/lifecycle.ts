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

export interface ConnectionVerificationEvidence {
  readonly connectionVerified: true;
  readonly checkedAt: number;
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

/** Applies a lifecycle transition. Verification is evidence-driven, never inferred from the state name. */
export function transitionConnectionLifecycle(
  current: ConnectionLifecycleRecord,
  next: IntegrationLifecycle,
  now = Date.now(),
  verification?: ConnectionVerificationEvidence,
): ConnectionLifecycleRecord {
  if (!transitions[current.lifecycle].includes(next)) {
    throw new Error(`Invalid connection lifecycle transition: ${current.lifecycle} -> ${next}`);
  }

  let connectionVerified = current.connectionVerified;
  if (next === "connected") {
    if (!verification || verification.connectionVerified !== true) {
      throw new Error("Provider verification evidence is required before marking connected");
    }
    if (verification.checkedAt > now || now - verification.checkedAt > 5 * 60 * 1000) {
      throw new Error("Provider verification evidence is stale or from the future");
    }
    connectionVerified = true;
  }
  if (next === "disconnected" || next === "revoked") connectionVerified = false;
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

import type { ProviderDescriptor } from "./contracts.js";

const riskClasses = new Set(["low", "medium", "high", "critical"]);
const lifecycleStates = new Set([
  "catalogued", "reviewed", "consent_pending", "connected",
  "health_checked", "enabled", "disconnected", "revoked",
]);

export function validateProviderRegistry(
  providers: readonly ProviderDescriptor[],
): readonly string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const provider of providers) {
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(provider.id)) {
      errors.push(`invalid provider id: ${provider.id}`);
    }
    if (ids.has(provider.id)) errors.push(`duplicate provider id: ${provider.id}`);
    ids.add(provider.id);
    if (!provider.name.trim()) errors.push(`missing provider name: ${provider.id}`);
    try {
      const url = new URL(provider.origin);
      if (url.protocol !== "https:" || url.username || url.password) {
        errors.push(`origin must be credential-free HTTPS: ${provider.id}`);
      }
    } catch {
      errors.push(`invalid provider origin: ${provider.id}`);
    }
    if (!riskClasses.has(provider.riskClass)) {
      errors.push(`invalid risk class: ${provider.id}`);
    }
    if (!lifecycleStates.has(provider.lifecycle)) {
      errors.push(`invalid lifecycle state: ${provider.id}`);
    }
    if (provider.lifecycle === "catalogued" &&
        (provider.connectionVerified || provider.enabledOperations.length > 0)) {
      errors.push(`catalogued provider cannot be connected or enabled: ${provider.id}`);
    }
    if (provider.lifecycle === "enabled" && !provider.connectionVerified) {
      errors.push(`enabled provider must have a verified connection: ${provider.id}`);
    }
  }
  return errors;
}

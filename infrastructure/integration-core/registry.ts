import type { IntegrationCoreConfig, IntegrationDescriptor, IntegrationHealthProbes, IntegrationId, IntegrationDiagnostics } from "./contracts.js";
const DEFINITIONS = [
  { id: "search", label: "TLCE Hybrid Search", capabilities: ["web-search", "reference-search"] },
  { id: "llm7", label: "LLM7 Language Model", capabilities: ["language-model"] },
  { id: "api-gateway", label: "TLCE API Gateway", capabilities: ["http-routing", "identity-boundary", "rate-limiting-boundary"] },
] as const;
function configuredState(id: IntegrationId, config: IntegrationCoreConfig) {
  if (id === "search") return {
    configured: config.search.publicProvidersEnabled || config.search.braveKeyConfigured,
    enabled: config.search.publicProvidersEnabled || config.search.braveKeyConfigured,
    details: [config.search.publicProvidersEnabled ? "Public reference providers enabled" : "Public providers disabled", config.search.braveKeyConfigured ? "Brave server credential detected" : "Brave credential not configured", "Provider credentials are never returned by diagnostics"],
  };
  if (id === "llm7") return {
    configured: config.llm7.apiKeyConfigured && config.llm7.securityPolicyConfigured,
    enabled: config.llm7.apiKeyConfigured && config.llm7.securityPolicyConfigured,
    details: [config.llm7.apiKeyConfigured ? "Provider credential detected" : "Provider credential missing", config.llm7.securityPolicyConfigured ? "Identity and rate-limit policy supplied" : "Security policy missing; requests must fail closed"],
  };
  return {
    configured: config.gateway.identityProviderConfigured && config.gateway.sharedRateLimiterConfigured,
    enabled: config.gateway.identityProviderConfigured && config.gateway.sharedRateLimiterConfigured,
    details: [config.gateway.identityProviderConfigured ? "Identity provider supplied" : "Identity provider missing", config.gateway.sharedRateLimiterConfigured ? "Shared rate limiter supplied" : "Shared rate limiter missing", "In-process routing alone is not an internet-facing gateway"],
  };
}
/** Central capability registry. Stores public configuration state only, never credentials. */
export class IntegrationRegistry {
  constructor(private readonly config: IntegrationCoreConfig, private readonly probes: IntegrationHealthProbes = {}) {}
  list(): readonly IntegrationDescriptor[] {
    return DEFINITIONS.map((definition) => {
      const state = configuredState(definition.id, this.config);
      return { id: definition.id, label: definition.label, capabilities: [...definition.capabilities], configured: state.configured, enabled: state.enabled, health: "not_checked" as const, details: state.details };
    });
  }
  async diagnostics(): Promise<IntegrationDiagnostics> {
    const integrations = await Promise.all(this.list().map(async (item) => {
      const probe = this.probes[item.id];
      if (!probe) return item;
      if (!item.enabled) return { ...item, health: "unavailable" as const };
      try { return { ...item, health: await probe.check() ? "healthy" as const : "degraded" as const }; }
      catch { return { ...item, health: "unavailable" as const }; }
    }));
    const blockedCount = integrations.filter((item) => !item.enabled || item.health === "unavailable").length;
    const allEnabledHealthy = integrations.length > 0 && integrations.every((item) => item.enabled && item.health === "healthy");
    const overall = allEnabledHealthy ? "ready" : blockedCount === integrations.length ? "blocked" : "partial";
    return { generatedAt: new Date().toISOString(), overall, integrations };
  }
}

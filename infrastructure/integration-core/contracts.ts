export type IntegrationId = "api-gateway" | "llm7" | "search";
export type IntegrationCapability = "http-routing" | "identity-boundary" | "rate-limiting-boundary" | "web-search" | "reference-search" | "language-model";
export type IntegrationHealth = "healthy" | "degraded" | "not_checked" | "unavailable";
export interface IntegrationDescriptor {
  id: IntegrationId; label: string; capabilities: readonly IntegrationCapability[];
  configured: boolean; enabled: boolean; health: IntegrationHealth; details: readonly string[];
}
export interface IntegrationCoreConfig {
  search: { publicProvidersEnabled: boolean; braveKeyConfigured: boolean };
  llm7: { apiKeyConfigured: boolean; securityPolicyConfigured: boolean };
  gateway: { identityProviderConfigured: boolean; sharedRateLimiterConfigured: boolean };
}
export interface IntegrationHealthProbe { check(): Promise<boolean> }
export type IntegrationHealthProbes = Partial<Record<IntegrationId, IntegrationHealthProbe>>;
export interface IntegrationDiagnostics {
  generatedAt: string; overall: "ready" | "partial" | "blocked"; integrations: readonly IntegrationDescriptor[];
}

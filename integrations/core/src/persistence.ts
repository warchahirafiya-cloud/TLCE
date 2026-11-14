import type { IntegrationGrant, IntegrationLifecycle, ProviderDescriptor } from "./contracts.js";
import type { ConnectionLifecycleRecord } from "./lifecycle.js";
import type { OAuthTransactionStore } from "./oauth.js";

export interface PersistedIntegrationConnection extends ConnectionLifecycleRecord {
  readonly id: string;
  readonly secretReferenceId?: string;
  readonly grantedScopes: readonly string[];
  readonly connectedPrincipalId: string;
}

export interface IntegrationConnectionRepository {
  get(tenantId: string, providerId: string): Promise<PersistedIntegrationConnection | undefined>;
  create(record: PersistedIntegrationConnection): Promise<void>;
  transition(input: {
    tenantId: string;
    providerId: string;
    expectedLifecycle: IntegrationLifecycle;
    next: PersistedIntegrationConnection;
  }): Promise<boolean>;
  list(tenantId: string): Promise<readonly PersistedIntegrationConnection[]>;
}

export interface IntegrationGrantRepository {
  get(input: { tenantId: string; principalId: string; providerId: string }): Promise<IntegrationGrant | undefined>;
  put(grant: IntegrationGrant): Promise<void>;
  revoke(input: { tenantId: string; principalId: string; providerId: string; revokedAt: number }): Promise<void>;
}

export interface ProviderRegistryRepository {
  get(providerId: string): Promise<ProviderDescriptor | undefined>;
  listEnabled(): Promise<readonly ProviderDescriptor[]>;
}

export interface IntegrationPersistence {
  readonly connections: IntegrationConnectionRepository;
  readonly grants: IntegrationGrantRepository;
  readonly providers: ProviderRegistryRepository;
  readonly oauthTransactions: OAuthTransactionStore;
}

export interface DurableIntegrationAuditRecord {
  readonly eventId: string;
  readonly occurredAt: number;
  readonly correlationId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly providerId: string;
  readonly operation: string;
  readonly outcome: "allowed" | "denied" | "succeeded" | "failed" | "revoked";
  readonly reason?: string;
}

import { createHash, randomBytes } from "node:crypto";

export interface OAuthProviderConfig {
  readonly providerId: string;
  readonly tenantId: string;
  readonly principalId: string;
  /** SHA-256 hash of the authenticated browser session identifier, base64url encoded. */
  readonly browserSessionHash: string;
  readonly authorizationEndpoint: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly extraAuthorizationParams?: Readonly<Record<string, string>>;
}

export interface PendingOAuthTransaction {
  readonly state: string;
  readonly providerId: string;
  readonly tenantId: string;
  readonly principalId: string;
  readonly browserSessionHash: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface OAuthTransactionStore {
  /** Must atomically reject duplicate state values. */
  put(transaction: PendingOAuthTransaction): Promise<void>;
  /** Must atomically return-and-delete a transaction to prevent replay. */
  consume(state: string, binding: OAuthCallbackBinding): Promise<PendingOAuthTransaction | undefined>;
}

export interface OAuthStartResult {
  readonly authorizationUrl: string;
  readonly expiresAt: number;
}

function requireHttpsEndpoint(value: string, label: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error(`${label} must be a credential-free HTTPS URL without a fragment`);
  }
  return url;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

/** Starts an authorization-code flow with transaction-specific PKCE S256. */
export async function startOAuthAuthorization(
  config: OAuthProviderConfig,
  store: OAuthTransactionStore,
  now = Date.now(),
  ttlMs = 10 * 60 * 1000,
): Promise<OAuthStartResult> {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(config.providerId)) {
    throw new Error("Invalid provider ID");
  }
  if (!config.clientId.trim()) throw new Error("OAuth client ID is required");
  if (!config.tenantId.trim() || !config.principalId.trim()) throw new Error("Authenticated tenant and principal are required");
  if (!/^[A-Za-z0-9_-]{43}$/.test(config.browserSessionHash)) throw new Error("A SHA-256 browser session hash is required");
  if (config.scopes.length === 0 || config.scopes.some((scope) => !scope.trim() || /[\s\u0000-\u001f]/.test(scope))) throw new Error("OAuth scopes must be non-empty tokens");
  if (ttlMs < 60_000 || ttlMs > 15 * 60_000) {
    throw new Error("OAuth transaction TTL must be between 1 and 15 minutes");
  }

  const endpoint = requireHttpsEndpoint(config.authorizationEndpoint, "Authorization endpoint");
  const redirect = requireHttpsEndpoint(config.redirectUri, "Redirect URI");
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(createHash("sha256").update(codeVerifier).digest());

  const extraParams = Object.entries(config.extraAuthorizationParams ?? {});
  for (const [key] of extraParams) {
    if (["response_type", "client_id", "redirect_uri", "scope", "state", "code_challenge", "code_challenge_method"].includes(key)) {
      throw new Error(`Reserved OAuth authorization parameter: ${key}`);
    }
  }

  const transaction: PendingOAuthTransaction = {
    state,
    providerId: config.providerId,
    tenantId: config.tenantId,
    principalId: config.principalId,
    browserSessionHash: config.browserSessionHash,
    codeVerifier,
    redirectUri: redirect.toString(),
    createdAt: now,
    expiresAt: now + ttlMs,
  };
  await store.put(transaction);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirect.toString(),
    scope: config.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  for (const [key, value] of extraParams) params.set(key, value);
  endpoint.search = params.toString();
  return { authorizationUrl: endpoint.toString(), expiresAt: transaction.expiresAt };
}

/** Consumes one callback state exactly once and rejects expired transactions. */
export interface OAuthCallbackBinding {
  readonly tenantId: string;
  readonly principalId: string;
  readonly browserSessionHash: string;
}

export async function consumeOAuthCallbackState(
  state: string,
  store: OAuthTransactionStore,
  binding: OAuthCallbackBinding,
  now = Date.now(),
): Promise<PendingOAuthTransaction> {
  if (!state || state.length > 256) throw new Error("Invalid OAuth state");
  const transaction = await store.consume(state, binding);
  if (!transaction) throw new Error("Unknown, expired, replayed, or incorrectly bound OAuth state");
  if (transaction.expiresAt <= now) throw new Error("OAuth state expired");
  return transaction;
}

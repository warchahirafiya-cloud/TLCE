import { createHash, randomBytes } from "node:crypto";

export interface OAuthProviderConfig {
  readonly providerId: string;
  readonly authorizationEndpoint: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scopes: readonly string[];
  readonly extraAuthorizationParams?: Readonly<Record<string, string>>;
}

export interface PendingOAuthTransaction {
  readonly state: string;
  readonly providerId: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface OAuthTransactionStore {
  /** Must atomically reject duplicate state values. */
  put(transaction: PendingOAuthTransaction): Promise<void>;
  /** Must atomically return-and-delete a transaction to prevent replay. */
  consume(state: string): Promise<PendingOAuthTransaction | undefined>;
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
  if (ttlMs < 60_000 || ttlMs > 15 * 60_000) {
    throw new Error("OAuth transaction TTL must be between 1 and 15 minutes");
  }

  const endpoint = requireHttpsEndpoint(config.authorizationEndpoint, "Authorization endpoint");
  const redirect = requireHttpsEndpoint(config.redirectUri, "Redirect URI");
  const state = base64Url(randomBytes(32));
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(createHash("sha256").update(codeVerifier).digest());

  const transaction: PendingOAuthTransaction = {
    state,
    providerId: config.providerId,
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
  for (const [key, value] of Object.entries(config.extraAuthorizationParams ?? {})) {
    if (["response_type", "client_id", "redirect_uri", "scope", "state", "code_challenge", "code_challenge_method"].includes(key)) {
      throw new Error(`Reserved OAuth authorization parameter: ${key}`);
    }
    params.set(key, value);
  }
  endpoint.search = params.toString();
  return { authorizationUrl: endpoint.toString(), expiresAt: transaction.expiresAt };
}

/** Consumes one callback state exactly once and rejects expired transactions. */
export async function consumeOAuthCallbackState(
  state: string,
  store: OAuthTransactionStore,
  now = Date.now(),
): Promise<PendingOAuthTransaction> {
  if (!state || state.length > 256) throw new Error("Invalid OAuth state");
  const transaction = await store.consume(state);
  if (!transaction) throw new Error("Unknown or already-used OAuth state");
  if (transaction.expiresAt <= now) throw new Error("OAuth state expired");
  return transaction;
}

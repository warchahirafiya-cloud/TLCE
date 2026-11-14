import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import type { OAuthTransactionStore, PendingOAuthTransaction } from "../src/oauth.js";
import { consumeOAuthCallbackState, startOAuthAuthorization } from "../src/oauth.js";

class MemoryTransactionStore implements OAuthTransactionStore {
  readonly entries = new Map<string, PendingOAuthTransaction>();
  async put(transaction: PendingOAuthTransaction): Promise<void> {
    if (this.entries.has(transaction.state)) throw new Error("duplicate state");
    this.entries.set(transaction.state, transaction);
  }
  async consume(state: string): Promise<PendingOAuthTransaction | undefined> {
    const value = this.entries.get(state);
    this.entries.delete(state);
    return value;
  }
}

const config = {
  providerId: "sample-provider",
  authorizationEndpoint: "https://auth.example/authorize",
  clientId: "public-client-id",
  redirectUri: "https://tlce.example/oauth/callback",
  scopes: ["profile.read", "files.read"],
};

test("creates authorization URL with fresh state and PKCE S256", async () => {
  const store = new MemoryTransactionStore();
  const result = await startOAuthAuthorization(config, store, 1_000);
  const url = new URL(result.authorizationUrl);
  const state = url.searchParams.get("state")!;
  const transaction = store.entries.get(state)!;
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update(transaction.codeVerifier).digest("base64url"));
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(result.expiresAt, 601_000);
});

test("uses unique state values for separate authorization attempts", async () => {
  const store = new MemoryTransactionStore();
  const a = await startOAuthAuthorization(config, store);
  const b = await startOAuthAuthorization(config, store);
  assert.notEqual(new URL(a.authorizationUrl).searchParams.get("state"), new URL(b.authorizationUrl).searchParams.get("state"));
});

test("rejects non-HTTPS endpoints and unsafe redirect URLs", async () => {
  const store = new MemoryTransactionStore();
  await assert.rejects(() => startOAuthAuthorization({ ...config, authorizationEndpoint: "http://auth.example" }, store));
  await assert.rejects(() => startOAuthAuthorization({ ...config, redirectUri: "https://user:pass@tlce.example/callback" }, store));
});

test("callback state is one-time and expires", async () => {
  const store = new MemoryTransactionStore();
  const result = await startOAuthAuthorization(config, store, 10_000);
  const state = new URL(result.authorizationUrl).searchParams.get("state")!;
  const tx = await consumeOAuthCallbackState(state, store, 10_001);
  assert.equal(tx.providerId, config.providerId);
  await assert.rejects(() => consumeOAuthCallbackState(state, store, 10_002));
  const expired = await startOAuthAuthorization(config, store, 20_000);
  const expiredState = new URL(expired.authorizationUrl).searchParams.get("state")!;
  await assert.rejects(() => consumeOAuthCallbackState(expiredState, store, 620_000));
});

test("rejects reserved parameter overrides", async () => {
  const store = new MemoryTransactionStore();
  await assert.rejects(() => startOAuthAuthorization({ ...config, extraAuthorizationParams: { state: "fixed-state" } }, store));
});

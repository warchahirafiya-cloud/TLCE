import test from "node:test";
import assert from "node:assert/strict";
import { GitHubOAuthProvider, type GitHubOAuthPolicy, type OAuthHttpClient, type OAuthHttpResponse } from "../src/github-oauth-provider.js";
import {
  OAuthTransactionService,
  type OAuthTransactionRecord,
  type OAuthTransactionStore,
} from "../../../core/identity/src/oauth-transaction.js";
import {
  OperatorSessionService,
  type OperatorSessionRecord,
  type OperatorSessionStore,
} from "../../../core/identity/src/operator-session.js";
import type { ExternalAccountLinkStore } from "../../../core/identity/src/external-identity.js";
import { MfaChallengeService, type MfaChallengeRecord, type MfaChallengeStore } from "../../../core/identity/src/mfa-challenge.js";

class MemoryOAuthStore implements OAuthTransactionStore {
  records = new Map<string, OAuthTransactionRecord>();
  async create(record: OAuthTransactionRecord) { this.records.set(record.stateHash, record); }
  async consume(hash: string, now: number) {
    const record = this.records.get(hash);
    if (!record) return null;
    this.records.delete(hash);
    return record.expiresAtMs > now ? record : null;
  }
}
class MemoryMfaStore implements MfaChallengeStore {
  records = new Map<string, MfaChallengeRecord>();
  async create(record: MfaChallengeRecord) { this.records.set(record.challengeTokenHash, record); }
  async reserveAttempt(hash: string, now: number, max: number) {
    const record = this.records.get(hash);
    if (!record || record.expiresAtMs <= now || record.attempts >= max) return null;
    const updated = Object.freeze({ ...record, attempts: record.attempts + 1 });
    this.records.set(hash, updated);
    return updated;
  }
  async consume(hash: string) { return this.records.delete(hash); }
}
class MemorySessionStore implements OperatorSessionStore {
  records = new Map<string, OperatorSessionRecord>();
  async create(record: OperatorSessionRecord) { this.records.set(record.sessionTokenHash, record); }
  async find(hash: string) { return this.records.get(hash) ?? null; }
  async replace(record: OperatorSessionRecord) { this.records.set(record.sessionTokenHash, record); }
  async delete(hash: string) { this.records.delete(hash); }
}
class FakeHttp implements OAuthHttpClient {
  calls: Array<{ method: string; url: string; headers: Readonly<Record<string, string>>; body?: string }> = [];
  tokenPayload: unknown = { access_token: "provider-access-token", token_type: "bearer" };
  profilePayload: unknown = { id: 334682116, login: "ignored-username" };
  tokenStatus = 200;
  profileStatus = 200;
  async post(url: string, headers: Readonly<Record<string, string>>, body: string): Promise<OAuthHttpResponse> {
    this.calls.push({ method: "POST", url, headers, body });
    return { status: this.tokenStatus, json: async () => this.tokenPayload };
  }
  async get(url: string, headers: Readonly<Record<string, string>>): Promise<OAuthHttpResponse> {
    this.calls.push({ method: "GET", url, headers });
    return { status: this.profileStatus, json: async () => this.profilePayload };
  }
}
const redirectUri = "https://console.tlce.store/auth/github/callback";
function fixture(policy: GitHubOAuthPolicy = {
  roles: ["viewer"],
  allowedModuleIds: ["store"],
}) {
  const oauthStore = new MemoryOAuthStore();
  const sessionStore = new MemorySessionStore();
  const transactions = new OAuthTransactionService({
    store: oauthStore,
    now: () => 1_800_000_000_000,
    randomState: () => "s".repeat(43),
  });
  const sessions = new OperatorSessionService({
    store: sessionStore,
    now: () => 1_800_000_000_000,
    randomToken: (() => { let i = 0; const values = ["t", "c"]; return () => values[i++].repeat(43); })(),
  });
  const http = new FakeHttp();
  const mfaChallenges = new MfaChallengeService({
    store: new MemoryMfaStore(),
    sessions: new OperatorSessionService({ store: sessionStore, now: () => 1_800_000_000_000 }),
    verifier: { async verify() { return true; } },
    now: () => 1_800_000_000_000,
    randomToken: () => "m".repeat(43),
  });
  const links: ExternalAccountLinkStore = {
    async findLink(provider, providerSubject) {
      assert.equal(provider, "github");
      assert.equal(providerSubject, "334682116");
      return { tlceSubject: "tlce-operator-01", active: true };
    },
  };
  const provider = new GitHubOAuthProvider({
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri,
    http,
    transactions,
    accountLinks: links,
    sessions,
    mfaChallenges,
    resolvePolicy: async (subject) => {
      assert.equal(subject, "tlce-operator-01");
      return policy;
    },
    now: () => new Date("2026-11-21T12:00:00.000Z"),
  });
  return { provider, http, oauthStore, sessionStore };
}
async function authorizationState(provider: GitHubOAuthProvider) {
  const started = await provider.start();
  const url = new URL(started.authorizationUrl);
  return { started, state: url.searchParams.get("state")! };
}

test("starts a server-side authorization transaction and requests only read:user", async () => {
  const { provider, oauthStore } = fixture();
  const { started, state } = await authorizationState(provider);
  const url = new URL(started.authorizationUrl);
  assert.equal(url.origin + url.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "client-id");
  assert.equal(url.searchParams.get("redirect_uri"), redirectUri);
  assert.equal(url.searchParams.get("scope"), "read:user");
  assert.equal(state.length, 43);
  assert.equal(oauthStore.records.size, 1);
});

test("exchanges code, verifies stable numeric GitHub ID, resolves existing link and creates session", async () => {
  const { provider, http, sessionStore } = fixture();
  const { state } = await authorizationState(provider);
  const result = await provider.complete({ code: "one-time-code", state });
  assert.equal(result.kind, "authenticated");
  if (result.kind !== "authenticated") throw new Error("Expected authenticated result");
  assert.match(result.cookie, /__Host-tlce_session=/);
  assert.equal(sessionStore.records.size, 1);
  assert.equal(http.calls.length, 2);
  assert.match(http.calls[0].body!, /client-secret/);
  assert.equal(http.calls[1].url, "https://api.github.com/user");
  assert.equal(http.calls[1].headers.authorization, "Bearer provider-access-token");
  assert.equal(JSON.stringify(result).includes("provider-access-token"), false);
});

test("consumes OAuth state before provider calls and rejects replay", async () => {
  const { provider, http } = fixture();
  const { state } = await authorizationState(provider);
  await provider.complete({ code: "one-time-code", state });
  const calls = http.calls.length;
  await assert.rejects(provider.complete({ code: "one-time-code", state }), /invalid, expired/);
  assert.equal(http.calls.length, calls);
});

test("rejects unlinked identities and never creates a session", async () => {
  const { provider, sessionStore } = fixture();
  const { state } = await authorizationState(provider);
  // Swap provider with a link store that returns no existing account link.
  const { provider: unlinked } = fixture();
  const unlinkedProvider = new GitHubOAuthProvider({
    clientId: "client-id",
    clientSecret: "client-secret",
    redirectUri,
    http: new FakeHttp(),
    transactions: new OAuthTransactionService({
      store: new MemoryOAuthStore(),
      now: () => 1_800_000_000_000,
      randomState: () => "u".repeat(43),
    }),
    accountLinks: { async findLink() { return null; } },
    sessions: new OperatorSessionService({ store: sessionStore }),
    mfaChallenges: new MfaChallengeService({
      store: new MemoryMfaStore(),
      sessions: new OperatorSessionService({ store: sessionStore }),
      verifier: { async verify() { return true; } },
    }),
    resolvePolicy: async () => ({ roles: ["viewer"], allowedModuleIds: [] }),
  });
  const started = await unlinkedProvider.start();
  const unlinkedState = new URL(started.authorizationUrl).searchParams.get("state")!;
  await assert.rejects(unlinkedProvider.complete({ code: "code", state: unlinkedState }), /not linked/);
  assert.equal(sessionStore.records.size, 0);
  void provider; void state; void unlinked;
});

test("requires separately verified MFA for privileged TLCE roles", async () => {
  const { provider, sessionStore } = fixture({
    roles: ["maintainer"],
    allowedModuleIds: ["store"],
  });
  const { state } = await authorizationState(provider);
  const result = await provider.complete({ code: "code", state });
  assert.equal(result.kind, "mfa_required");
  if (result.kind !== "mfa_required") throw new Error("Expected MFA challenge");
  assert.match(result.challengeToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(sessionStore.records.size, 0);
});

test("rejects provider token and profile errors", async () => {
  const tokenFixture = fixture();
  const tokenState = await authorizationState(tokenFixture.provider);
  tokenFixture.http.tokenStatus = 401;
  await assert.rejects(tokenFixture.provider.complete({ code: "code", state: tokenState.state }), /could not be completed/);

  const profileFixture = fixture();
  const profileState = await authorizationState(profileFixture.provider);
  profileFixture.http.profilePayload = { id: "334682116" };
  await assert.rejects(profileFixture.provider.complete({ code: "code", state: profileState.state }), /invalid account identity/);
});

test("rejects malformed authorization code before consuming provider credentials", async () => {
  const { provider, http } = fixture();
  const { state } = await authorizationState(provider);
  await assert.rejects(provider.complete({ code: "bad code", state }), /Invalid GitHub authorization response/);
  assert.equal(http.calls.length, 0);
});

test("requires exact HTTPS callback configuration", () => {
  const { provider } = fixture();
  assert.throws(() => new GitHubOAuthProvider({
    clientId: "id",
    clientSecret: "secret",
    redirectUri: "http://console.tlce.store/callback",
    http: new FakeHttp(),
    transactions: new OAuthTransactionService({ store: new MemoryOAuthStore() }),
    accountLinks: { async findLink() { return null; } },
    sessions: new OperatorSessionService({ store: new MemorySessionStore() }),
    mfaChallenges: new MfaChallengeService({
      store: new MemoryMfaStore(),
      sessions: new OperatorSessionService({ store: new MemorySessionStore() }),
      verifier: { async verify() { return true; } },
    }),
    resolvePolicy: async () => ({ roles: ["viewer"], allowedModuleIds: [] }),
  }), /HTTPS/);
  void provider;
});

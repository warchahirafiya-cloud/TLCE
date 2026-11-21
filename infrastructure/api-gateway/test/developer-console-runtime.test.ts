import test from "node:test";
import assert from "node:assert/strict";
import {
  createTlceDeveloperConsoleRuntime,
  type TlceDeveloperConsoleRuntimeOptions,
} from "../src/developer-console-runtime.js";
import type { PostgresQueryExecutor, PostgresQueryResult } from "../../persistence/postgres/src/postgres-operator-session-store.js";
import type { OAuthHttpClient, OAuthHttpResponse } from "../src/github-oauth-provider.js";
import type { TotpFactorVerifier } from "../../../core/identity/src/mfa-challenge.js";

class FakeDatabase implements PostgresQueryExecutor {
  calls: Array<{ text: string; values: ReadonlyArray<unknown> }> = [];
  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: ReadonlyArray<unknown> = [],
  ): Promise<PostgresQueryResult<Row>> {
    this.calls.push({ text, values });
    return { rows: [], rowCount: 0 };
  }
}
const http: OAuthHttpClient = {
  async post(): Promise<OAuthHttpResponse> { return { status: 500, async json() { return {}; } }; },
  async get(): Promise<OAuthHttpResponse> { return { status: 500, async json() { return {}; } }; },
};
function options(database: FakeDatabase): TlceDeveloperConsoleRuntimeOptions {
  return {
    database,
    readModel: {
      async getOverview() { return { registeredModules: 0, readyModules: 0, degradedModules: 0, failedModules: 0 }; },
      async listModules() { return []; },
    },
    oauthHttp: http,
    githubClientId: "client-id",
    githubClientSecret: "runtime-secret",
    githubRedirectUri: "https://console.tlce.store/auth/github/callback",
    allowedOrigins: ["https://console.tlce.store"],
    totpVerifier: { async verify() { return false; } } satisfies TotpFactorVerifier,
    resolveOperatorPolicy: async () => ({
      roles: ["viewer"],
      allowedModuleIds: [],
    }),
  };
}

test("composes the PostgreSQL stores, identity services and HTTP routes without opening a listener", async () => {
  const database = new FakeDatabase();
  const runtime = createTlceDeveloperConsoleRuntime(options(database));
  const unknown = await runtime.handle({ method: "GET", url: "/health", headers: {} });
  assert.equal(unknown.status, 404);
  assert.equal(database.calls.length, 0);
});

test("routes OAuth start through the composed PostgreSQL transaction store", async () => {
  const database = new FakeDatabase();
  const runtime = createTlceDeveloperConsoleRuntime(options(database));
  const response = await runtime.handle({
    method: "GET",
    url: "/auth/github/start",
    headers: {},
  });
  assert.equal(response.status, 302);
  const location = response.headers.location;
  assert.equal(typeof location, "string");
  if (typeof location === "string") {
    assert.match(location, /^https:\/\/github\.com\/login\/oauth\/authorize/);
  }
  assert.equal(database.calls.length, 1);
  assert.match(database.calls[0].text, /INSERT INTO tlce_oauth_transactions/);
  assert.equal(JSON.stringify(database.calls[0].values).includes("runtime-secret"), false);
});

test("does not instantiate runtime with an insecure callback or origin", () => {
  const database = new FakeDatabase();
  assert.throws(() => createTlceDeveloperConsoleRuntime({
    ...options(database),
    githubRedirectUri: "http://console.tlce.store/auth/github/callback",
  }), /HTTPS/);
  assert.throws(() => createTlceDeveloperConsoleRuntime({
    ...options(database),
    allowedOrigins: ["http://console.tlce.store"],
  }), /HTTPS/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { GitHubOAuthRoutes } from "../src/github-oauth-routes.js";

function fixture(overrides: Record<string, unknown> = {}) {
  const calls: unknown[] = [];
  const provider = {
    async start() {
      calls.push("start");
      return {
        authorizationUrl: "https://github.com/login/oauth/authorize?client_id=id&state=opaque",
        expiresAt: "2026-11-21T12:05:00.000Z",
      };
    },
    async complete(input: { code: string; state: string }) {
      calls.push(input);
      return {
        cookie: "__Host-tlce_session=opaque-session; Path=/; Secure; HttpOnly; SameSite=Lax",
        expiresAt: "2026-11-21T20:00:00.000Z",
      };
    },
    ...overrides,
  };
  return { routes: new GitHubOAuthRoutes({ provider }), calls };
}

test("redirects to provider using a server-generated authorization URL", async () => {
  const { routes, calls } = fixture();
  const result = await routes.handle({ method: "GET", url: "/auth/github/start" });
  assert.equal(result?.status, 302);
  assert.equal(result?.headers.location, "https://github.com/login/oauth/authorize?client_id=id&state=opaque");
  assert.equal(result?.headers["cache-control"], "no-store");
  assert.equal(result?.headers["referrer-policy"], "no-referrer");
  assert.deepEqual(calls, ["start"]);
});

test("callback exchanges exactly one code and state then sets only the session cookie", async () => {
  const { routes, calls } = fixture();
  const result = await routes.handle({
    method: "GET",
    url: "/auth/github/callback?code=single-use-code&state=one-time-state",
  });
  assert.equal(result?.status, 303);
  assert.equal(result?.headers.location, "/developer-console/");
  assert.match(result?.headers["set-cookie"], /^__Host-tlce_session=/);
  assert.equal(JSON.stringify(result).includes("single-use-code"), false);
  assert.deepEqual(calls, [{ code: "single-use-code", state: "one-time-state" }]);
});

test("rejects duplicate, missing or denied callback parameters", async () => {
  const { routes, calls } = fixture();
  const duplicate = await routes.handle({
    method: "GET",
    url: "/auth/github/callback?code=a&code=b&state=s",
  });
  const missing = await routes.handle({
    method: "GET",
    url: "/auth/github/callback?code=a",
  });
  const denied = await routes.handle({
    method: "GET",
    url: "/auth/github/callback?error=access_denied&state=s",
  });
  assert.equal(duplicate?.status, 400);
  assert.equal(missing?.status, 400);
  assert.equal(denied?.status, 400);
  assert.deepEqual(calls, []);
});

test("does not reflect callback errors or secrets", async () => {
  const { routes } = fixture({
    async complete() {
      throw new Error("provider token=secret access_token=do-not-reflect");
    },
  });
  const result = await routes.handle({
    method: "GET",
    url: "/auth/github/callback?code=secret-code&state=secret-state",
  });
  assert.equal(result?.status, 401);
  assert.equal(result?.body, JSON.stringify({ error: "authentication_failed" }));
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("returns null for unrelated routes and unsupported methods", async () => {
  const { routes } = fixture();
  assert.equal(await routes.handle({ method: "POST", url: "/auth/github/start" }), null);
  assert.equal(await routes.handle({ method: "GET", url: "/health" }), null);
});

test("rejects external or unsafe success redirect paths", () => {
  const { routes } = fixture();
  assert.throws(() => new GitHubOAuthRoutes({
    provider: { async start() { return { authorizationUrl: "", expiresAt: "" }; }, async complete() { return { cookie: "", expiresAt: "" }; } },
    successPath: "//attacker.example/",
  }), /safe local path/);
  assert.throws(() => new GitHubOAuthRoutes({
    provider: { async start() { return { authorizationUrl: "", expiresAt: "" }; }, async complete() { return { cookie: "", expiresAt: "" }; } },
    successPath: "https://attacker.example/",
  }), /safe local path/);
});

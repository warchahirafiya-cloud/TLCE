import test from "node:test";
import assert from "node:assert/strict";
import { GitHubOAuthRoutes } from "../src/github-oauth-routes.js";

function fixture(overrides: Record<string, unknown> = {}, mfaOverrides: Record<string, unknown> = {}) {
  const calls: unknown[] = [];
  const provider = {
    async start() {
      calls.push("start");
      return { authorizationUrl: "https://github.com/login/oauth/authorize?client_id=id&state=opaque", expiresAt: "2026-11-21T12:05:00.000Z" };
    },
    async complete(input: { code: string; state: string }) {
      calls.push(input);
      return { kind: "authenticated", cookie: "__Host-tlce_session=opaque-session; Path=/; Secure; HttpOnly; SameSite=Lax", expiresAt: "2026-11-21T20:00:00.000Z" };
    },
    ...overrides,
  };
  const mfa = {
    async complete(token: string, code: string) {
      calls.push({ token, code });
      return { session: { cookie: "__Host-tlce_session=verified-session; Path=/; Secure; HttpOnly; SameSite=Lax" } };
    },
    ...mfaOverrides,
  };
  return { routes: new GitHubOAuthRoutes({ provider, mfaChallenges: mfa, allowedOrigins: ["https://console.tlce.store"] }), calls };
}

test("redirects to GitHub using a server-generated authorization URL", async () => {
  const { routes, calls } = fixture();
  const result = await routes.handle({ method: "GET", url: "/auth/github/start" });
  assert.equal(result?.status, 302);
  assert.equal(result?.headers.location, "https://github.com/login/oauth/authorize?client_id=id&state=opaque");
  assert.equal(result?.headers["cache-control"], "no-store");
  assert.equal(result?.headers["referrer-policy"], "no-referrer");
  assert.deepEqual(calls, ["start"]);
});

test("ordinary users receive the session cookie after OAuth callback", async () => {
  const { routes } = fixture();
  const result = await routes.handle({ method: "GET", url: "/auth/github/callback?code=single-use-code&state=one-time-state" });
  assert.equal(result?.status, 303);
  assert.equal(result?.headers.location, "/developer-console/");
  assert.match(result?.headers["set-cookie"] as string, /^__Host-tlce_session=/);
  assert.equal(JSON.stringify(result).includes("single-use-code"), false);
});

test("privileged OAuth callback sets only an HttpOnly MFA challenge cookie", async () => {
  const { routes } = fixture({
    async complete() { return { kind: "mfa_required", challengeToken: "m".repeat(43), expiresAt: "2026-11-21T12:05:00.000Z" }; },
  });
  const result = await routes.handle({ method: "GET", url: "/auth/github/callback?code=code&state=state" });
  assert.equal(result?.status, 303);
  assert.equal(result?.headers.location, "/developer-console/mfa");
  const cookie = result?.headers["set-cookie"] as string;
  assert.match(cookie, /^__Host-tlce_mfa_challenge=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.doesNotMatch(cookie, /tlce_session=/);
});

test("MFA verification requires trusted origin, JSON body and challenge cookie", async () => {
  const { routes, calls } = fixture();
  const denied = await routes.handle({ method: "POST", url: "/auth/mfa/verify", headers: { origin: "https://attacker.example", "content-type": "application/json", cookie: `__Host-tlce_mfa_challenge=${"m".repeat(43)}` }, body: JSON.stringify({ code: "123456" }) });
  assert.equal(denied?.status, 403);
  const missing = await routes.handle({ method: "POST", url: "/auth/mfa/verify", headers: { origin: "https://console.tlce.store", "content-type": "application/json" }, body: JSON.stringify({ code: "123456" }) });
  assert.equal(missing?.status, 401);
  assert.deepEqual(calls, []);
});

test("successful MFA verification issues session and clears challenge cookie separately", async () => {
  const { routes, calls } = fixture();
  const result = await routes.handle({
    method: "POST",
    url: "/auth/mfa/verify",
    headers: {
      origin: "https://console.tlce.store",
      "content-type": "application/json",
      cookie: `__Host-tlce_mfa_challenge=${"m".repeat(43)}`,
    },
    body: JSON.stringify({ code: "123456" }),
  });
  assert.equal(result?.status, 204);
  const cookies = result?.headers["set-cookie"] as ReadonlyArray<string>;
  assert.equal(cookies.length, 2);
  assert.match(cookies[0], /^__Host-tlce_session=/);
  assert.match(cookies[1], /^__Host-tlce_mfa_challenge=;.*Max-Age=0/);
  assert.deepEqual(calls, [{ token: "m".repeat(43), code: "123456" }]);
});

test("rejects malformed MFA payload and does not reflect secrets", async () => {
  const { routes } = fixture({}, { async complete() { throw new Error("sensitive verifier detail"); } });
  const malformed = await routes.handle({
    method: "POST", url: "/auth/mfa/verify",
    headers: { origin: "https://console.tlce.store", "content-type": "application/json", cookie: `__Host-tlce_mfa_challenge=${"m".repeat(43)}` },
    body: JSON.stringify({ code: "12345", extra: "secret" }),
  });
  assert.equal(malformed?.status, 400);
  const failed = await routes.handle({
    method: "POST", url: "/auth/mfa/verify",
    headers: { origin: "https://console.tlce.store", "content-type": "application/json", cookie: `__Host-tlce_mfa_challenge=${"m".repeat(43)}` },
    body: JSON.stringify({ code: "123456" }),
  });
  assert.equal(failed?.status, 401);
  assert.equal(JSON.stringify(failed).includes("sensitive"), false);
});

test("rejects duplicate, missing or denied OAuth callback parameters", async () => {
  const { routes, calls } = fixture();
  const duplicate = await routes.handle({ method: "GET", url: "/auth/github/callback?code=a&code=b&state=s" });
  const missing = await routes.handle({ method: "GET", url: "/auth/github/callback?code=a" });
  const denied = await routes.handle({ method: "GET", url: "/auth/github/callback?error=access_denied&state=s" });
  assert.equal(duplicate?.status, 400);
  assert.equal(missing?.status, 400);
  assert.equal(denied?.status, 400);
  assert.deepEqual(calls, []);
});

test("does not reflect callback errors or secrets", async () => {
  const { routes } = fixture({ async complete() { throw new Error("provider token=secret access_token=do-not-reflect"); } });
  const result = await routes.handle({ method: "GET", url: "/auth/github/callback?code=secret-code&state=secret-state" });
  assert.equal(result?.status, 401);
  assert.equal(result?.body, JSON.stringify({ error: "authentication_failed" }));
  assert.equal(JSON.stringify(result).includes("secret"), false);
});

test("rejects unsafe redirect paths and unknown routes", async () => {
  const { routes } = fixture();
  assert.equal(await routes.handle({ method: "GET", url: "/health" }), null);
  assert.equal(await routes.handle({ method: "POST", url: "/auth/github/start" }), null);
  assert.throws(() => new GitHubOAuthRoutes({
    provider: { async start() { return { authorizationUrl: "", expiresAt: "" }; }, async complete() { return { kind: "authenticated", cookie: "", expiresAt: "" }; } },
    mfaChallenges: { async complete() { return { session: { cookie: "" } }; } },
    allowedOrigins: ["https://console.tlce.store"],
    successPath: "//attacker.example/",
  }), /safe local path/);
});

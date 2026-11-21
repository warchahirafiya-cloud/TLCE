import test from "node:test";
import assert from "node:assert/strict";
import worker, { RateLimiter } from "../index.js";

const env = {
  TLCE_ORIGIN: "https://tlce.store",
  CF_ACCESS_TEAM_DOMAIN: "",
  CF_ACCESS_AUD: "",
  RATE_LIMITER: { idFromName: () => "stub", get: () => ({ fetch: async () => new Response(JSON.stringify({ allowed: true })) }) },
};

test("health endpoint returns only non-sensitive liveness metadata", async () => {
  const response = await worker.fetch(new Request("https://worker.example/health"), env as never);
  assert.equal(response.status, 200);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.status, "ok");
  assert.equal("configured" in body, false);
  assert.equal("credentials" in body, false);
});

test("unknown routes are not exposed", async () => {
  const response = await worker.fetch(new Request("https://worker.example/admin"), env as never);
  assert.equal(response.status, 404);
});

test("CORS preflight is restricted to the configured site origin", async () => {
  const allowed = await worker.fetch(new Request("https://worker.example/api/search", {
    method: "OPTIONS", headers: { origin: "https://tlce.store" },
  }), env as never);
  assert.equal(allowed.status, 204);
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://tlce.store");

  const denied = await worker.fetch(new Request("https://worker.example/api/search", {
    method: "OPTIONS", headers: { origin: "https://attacker.example" },
  }), env as never);
  assert.equal(denied.status, 403);
});

test("Durable Object enforces a fixed per-object request window", async () => {
  let stored: { startedAt: number; count: number } | undefined;
  const storage = {
    get: async () => stored,
    put: async (_key: string, value: { startedAt: number; count: number }) => { stored = value; },
    transaction: async (callback: (txn: { get: typeof storage.get; put: typeof storage.put }) => Promise<boolean>) =>
      callback({ get: storage.get, put: storage.put }),
  };
  const limiter = new RateLimiter({ storage } as never);
  let allowed = true;
  for (let i = 0; i < 20; i += 1) {
    const response = await limiter.fetch(new Request("https://rate-limit.internal/consume", { method: "POST" }));
    allowed = (await response.json() as { allowed: boolean }).allowed;
    assert.equal(allowed, true);
  }
  const blocked = await limiter.fetch(new Request("https://rate-limit.internal/consume", { method: "POST" }));
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json() as { allowed: boolean }).allowed, false);
});

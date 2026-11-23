import test from "node:test";
import assert from "node:assert/strict";
import worker, { RateLimiter, allowedMime, detectAllowedFile, runAiWithFallback, verifyApiSignature, verifyMagic } from "../index.js";

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

class MemoryStorage {
  private readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return this.values.get(key) as T | undefined; }
  async put<T>(key: string, value: T): Promise<void> { this.values.set(key, value); }
  async transaction<T>(callback: (txn: MemoryStorage) => Promise<T>): Promise<T> { return callback(this); }
}

test("Durable Object enforces a fixed per-object request window", async () => {
  const limiter = new RateLimiter({ storage: new MemoryStorage() } as never);
  for (let i = 0; i < 20; i += 1) {
    const response = await limiter.fetch(new Request("https://rate-limit.internal/consume", { method: "POST" }));
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { allowed: boolean }).allowed, true);
  }
  const blocked = await limiter.fetch(new Request("https://rate-limit.internal/consume", { method: "POST" }));
  assert.equal(blocked.status, 429);
  assert.equal((await blocked.json() as { allowed: boolean }).allowed, false);
});

test("Durable Object consumes a nonce once and rejects replay", async () => {
  const limiter = new RateLimiter({ storage: new MemoryStorage() } as never);
  const body = JSON.stringify({ nonce: "f9e30b15-0b7d-4c5a-9c4a-7b1f6d45a9f1", expiresAt: Math.floor(Date.now() / 1000) + 60 });
  const first = await limiter.fetch(new Request("https://rate-limit.internal/nonce", { method: "POST", body }));
  const replay = await limiter.fetch(new Request("https://rate-limit.internal/nonce", { method: "POST", body }));
  assert.equal(first.status, 200);
  assert.equal((await first.json() as { allowed: boolean }).allowed, true);
  assert.equal(replay.status, 409);
  assert.equal((await replay.json() as { allowed: boolean }).allowed, false);
});

test("file MIME allowlist rejects unapproved and non-string values", () => {
  assert.deepEqual(allowedMime("image/png"), { mime: "image/png", extension: "png" });
  assert.deepEqual(allowedMime("image/jpeg"), { mime: "image/jpeg", extension: "jpg" });
  assert.equal(allowedMime("text/html"), null);
  assert.equal(allowedMime(null), null);
});

test("Magic Number detection accepts PNG, JPEG and PDF signatures only", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const pdf = new TextEncoder().encode("%PDF-1.7");
  const html = new TextEncoder().encode("<html>");
  assert.deepEqual(detectAllowedFile(png), { mime: "image/png", extension: "png" });
  assert.deepEqual(detectAllowedFile(jpeg), { mime: "image/jpeg", extension: "jpg" });
  assert.deepEqual(detectAllowedFile(pdf), { mime: "application/pdf", extension: "pdf" });
  assert.equal(detectAllowedFile(html), null);
  assert.equal(verifyMagic(png, "image/png"), true);
  assert.equal(verifyMagic(png, "image/jpeg"), false);
});

test("Queue structurally validates a quarantined object without promoting it", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let deleted = false;
  let acknowledged = false;
  const bucket = {
    get: async () => ({
      size: png.byteLength,
      customMetadata: { ownerHash: "owner-hash", status: "quarantined", detectedType: "image/png" },
      arrayBuffer: async () => png.buffer.slice(0),
    }),
    delete: async () => { deleted = true; },
  };
  await worker.queue!({
    messages: [{
      body: { type: "inspect-quarantine-object", objectKey: "quarantine/owner-hash/file.png", ownerHash: "owner-hash", contentType: "image/png", expectedSize: png.byteLength },
      ack: () => { acknowledged = true; },
      retry: () => { throw new Error("unexpected retry"); },
    }],
  } as never, { UPLOADS: bucket } as never);
  assert.equal(acknowledged, true);
  assert.equal(deleted, false);
});

test("Queue deletes a quarantined object when its signature does not match metadata", async () => {
  const html = new TextEncoder().encode("<html>");
  let deleted = false;
  let acknowledged = false;
  const bucket = {
    get: async () => ({
      size: html.byteLength,
      customMetadata: { ownerHash: "owner-hash", status: "quarantined", detectedType: "image/png" },
      arrayBuffer: async () => html.buffer.slice(0),
    }),
    delete: async () => { deleted = true; },
  };
  await worker.queue!({
    messages: [{
      body: { type: "inspect-quarantine-object", objectKey: "quarantine/owner-hash/file.png", ownerHash: "owner-hash", contentType: "image/png", expectedSize: html.byteLength },
      ack: () => { acknowledged = true; },
      retry: () => { throw new Error("unexpected retry"); },
    }],
  } as never, { UPLOADS: bucket } as never);
  assert.equal(acknowledged, true);
  assert.equal(deleted, true);
});

test("AI provider fallback uses Groq when Workers AI fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    choices: [{ message: { content: "fallback response" } }],
  }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    const result = await runAiWithFallback("test prompt", {
      AI_PROVIDER: "workers-ai",
      AI_FALLBACK_PROVIDERS: "groq",
      AI: { run: async () => { throw new Error("primary unavailable"); } },
      GROQ_API_KEY: "test-only-key",
    } as never);
    assert.equal(result.provider, "groq");
    assert.equal(result.answer, "fallback response");
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("HMAC API signature is scoped, body-bound and replay protected", async () => {
  const secretBytes = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const secret = Buffer.from(secretBytes).toString("base64url");
  const keyId = "test-service";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = "c6ef3e53-6b28-45af-8b1a-b5a1d5ad7c42";
  const url = new URL("https://worker.example/api/files/presign?kind=avatar");
  const bodyText = JSON.stringify({ contentType: "image/png", size: 8 });
  const bodyHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(bodyText).buffer as ArrayBuffer);
  const bodyHash = Array.from(new Uint8Array(bodyHashBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const canonical = ["POST", url.pathname + url.search, timestamp, nonce, bodyHash].join("\n");
  const key = await crypto.subtle.importKey("raw", new Uint8Array(secretBytes).buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical).buffer as ArrayBuffer);
  const signature = Array.from(new Uint8Array(signatureBuffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

  const limiter = new RateLimiter({ storage: new MemoryStorage() } as never);
  const signedEnv = {
    TLCE_API_KEYS_JSON: JSON.stringify({ [keyId]: secret }),
    RATE_LIMITER: { idFromName: () => "nonce-store", get: () => ({ fetch: (request: Request) => limiter.fetch(request) }) },
  };
  const makeRequest = (body = bodyText) => new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tlce-key-id": keyId,
      "x-tlce-timestamp": timestamp,
      "x-tlce-nonce": nonce,
      "x-tlce-signature": signature,
    },
    body,
  });
  assert.equal(await verifyApiSignature(makeRequest(bodyText + " "), signedEnv as never), null);
  assert.equal(await verifyApiSignature(makeRequest(), signedEnv as never), "api-key:test-service");
  assert.equal(await verifyApiSignature(makeRequest(), signedEnv as never), null);
  const wrongRoute = new Request("https://worker.example/api/ai/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-tlce-key-id": keyId,
      "x-tlce-timestamp": timestamp,
      "x-tlce-nonce": "c6ef3e53-6b28-45af-8b1a-b5a1d5ad7c43",
      "x-tlce-signature": signature,
    },
    body: bodyText,
  });
  assert.equal(await verifyApiSignature(wrongRoute, signedEnv as never), null);
});

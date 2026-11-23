import { searchWeb } from "../search/search-engine.js";

interface AiBinding {
  run(model: string, input: { messages: Array<{ role: "system" | "user"; content: string }> }): Promise<unknown>;
}
interface R2BucketLike {
  put(key: string, value: ArrayBuffer, options?: {
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  }): Promise<{ etag: string }>;
}
interface Env {
  TLCE_ORIGIN: string;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  BRAVE_SEARCH_API_KEY?: string;
  AI?: AiBinding;
  AI_PROVIDER?: string;
  AI_MODEL?: string;
  GROQ_API_KEY?: string;
  GEMINI_API_KEY?: string;
  UPLOADS?: R2BucketLike;
  AUTOMATION_WEBHOOK_URL?: string;
  AUTOMATION_WEBHOOK_SECRET?: string;
  RATE_LIMITER: DurableObjectNamespaceLike;
}
interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(request: Request): Promise<Response> };
}
interface DurableObjectStorageLike {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  transaction<T>(closure: (txn: { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void> }) => Promise<T>): Promise<T>;
}
interface DurableObjectStateLike { storage: DurableObjectStorageLike; }
interface RateWindow { startedAt: number; count: number; }
interface AccessJwk extends JsonWebKey { kid?: string; kty?: string; }

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const MAX_QUERY_LENGTH = 240;
const MAX_PROMPT_LENGTH = 8_000;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
let cachedJwks: { expiresAt: number; keys: AccessJwk[] } | undefined;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      ...extra,
    },
  });
}
function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  if (origin !== allowedOrigin) return {};
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    "vary": "Origin",
  };
}
function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function decodeJsonPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Record<string, unknown>;
}
async function getJwks(teamDomain: string): Promise<AccessJwk[]> {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.keys;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Access keyset unavailable");
  const payload = await response.json() as { keys?: AccessJwk[] };
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) throw new Error("Access keyset invalid");
  cachedJwks = { keys: payload.keys, expiresAt: Date.now() + 5 * 60_000 };
  return payload.keys;
}
async function verifyAccessJwt(token: string, env: Env): Promise<string | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = decodeJsonPart(parts[0]!);
    const claims = decodeJsonPart(parts[1]!);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== "number" || claims.exp <= now) return null;
    if (typeof claims.nbf === "number" && claims.nbf > now + 30) return null;
    if (claims.iss !== `https://${env.CF_ACCESS_TEAM_DOMAIN}`) return null;
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!audiences.includes(env.CF_ACCESS_AUD) || typeof claims.sub !== "string" || !claims.sub) return null;
    const jwks = await getJwks(env.CF_ACCESS_TEAM_DOMAIN);
    const jwk = jwks.find((key) => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`).buffer as ArrayBuffer;
    const signature = decodeBase64Url(parts[2]!).slice().buffer as ArrayBuffer;
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signingInput) ? claims.sub : null;
  } catch {
    return null;
  }
}
async function consumeRateLimit(env: Env, subject: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(subject));
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = env.RATE_LIMITER.idFromName(key);
  const response = await env.RATE_LIMITER.get(id).fetch(new Request("https://rate-limit.internal/consume", { method: "POST" }));
  return response.ok && (await response.json() as { allowed?: boolean }).allowed === true;
}
async function requireIdentity(request: Request, env: Env): Promise<{ subject: string } | { response: Response }> {
  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    return { response: json({ error: "Identity provider is not configured" }, 503) };
  }
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion) return { response: json({ error: "Authentication required" }, 401) };
  const subject = await verifyAccessJwt(assertion, env);
  if (!subject) return { response: json({ error: "Invalid identity assertion" }, 401) };
  try {
    if (!await consumeRateLimit(env, subject)) return { response: json({ error: "Rate limit exceeded" }, 429) };
  } catch {
    return { response: json({ error: "Rate limit service unavailable" }, 503) };
  }
  return { subject };
}
async function runAi(prompt: string, env: Env): Promise<string> {
  const provider = (env.AI_PROVIDER ?? "workers-ai").toLowerCase();
  if (provider === "workers-ai") {
    if (!env.AI) throw new Error("Workers AI binding is not configured");
    const result = await env.AI.run(env.AI_MODEL ?? "@cf/meta/llama-3.3-70b-instruct-fp8-fast", {
      messages: [
        { role: "system", content: "You are the TLCE assistant. Be accurate, concise, and clearly state uncertainty." },
        { role: "user", content: prompt },
      ],
    }) as { response?: string };
    if (typeof result?.response !== "string" || !result.response) throw new Error("Workers AI returned no text");
    return result.response;
  }
  if (provider === "groq") {
    if (!env.GROQ_API_KEY) throw new Error("Groq API key is not configured");
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: "You are the TLCE assistant. Be accurate, concise, and clearly state uncertainty." },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("Groq request failed");
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content) throw new Error("Groq returned no text");
    return content;
  }
  if (provider === "gemini") {
    if (!env.GEMINI_API_KEY) throw new Error("Gemini API key is not configured");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": env.GEMINI_API_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "You are the TLCE assistant. Be accurate, concise, and clearly state uncertainty." }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error("Gemini request failed");
    const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!content) throw new Error("Gemini returned no text");
    return content;
  }
  throw new Error("Unsupported AI provider");
}
function detectAllowedFile(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) return { mime: "application/pdf", extension: "pdf" };
  return null;
}
async function uploadToQuarantine(request: Request, env: Env, subject: string): Promise<Response> {
  if (!env.UPLOADS) return json({ error: "File storage is not configured" }, 503);
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (!Number.isFinite(declaredLength) || declaredLength <= 0 || declaredLength > MAX_UPLOAD_BYTES) {
    return json({ error: "File must be between 1 byte and 5 MiB" }, 413);
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) return json({ error: "Invalid file size" }, 413);
  const detected = detectAllowedFile(bytes);
  if (!detected) return json({ error: "Only PNG, JPEG, and PDF files are accepted" }, 415);
  const id = crypto.randomUUID();
  const key = `quarantine/${id}.${detected.extension}`;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const stored = await env.UPLOADS.put(key, bytes.buffer as ArrayBuffer, {
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: {
      status: "quarantined",
      uploadedAt: new Date().toISOString(),
      ownerHash: await hashSubject(subject),
      sha256,
      detectedType: detected.mime,
    },
  });
  return json({
    uploadId: id,
    status: "quarantined",
    message: "Upload stored privately. It is not downloadable or trusted until malware scanning and release are implemented.",
    sha256,
    etag: stored.etag,
  }, 202);
}
async function hashSubject(subject: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(subject));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class RateLimiter {
  constructor(private readonly state: DurableObjectStateLike) {}
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const now = Date.now();
    const allowed = await this.state.storage.transaction(async (txn) => {
      const current = await txn.get<RateWindow>("window");
      const window = !current || now - current.startedAt >= WINDOW_MS ? { startedAt: now, count: 0 } : current;
      if (window.count >= MAX_REQUESTS) return false;
      window.count += 1;
      await txn.put("window", window);
      return true;
    });
    return json({ allowed }, allowed ? 200 : 429);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") ?? "";
    const cors = corsHeaders(origin, env.TLCE_ORIGIN);
    if (request.method === "OPTIONS") {
      return origin === env.TLCE_ORIGIN
        ? new Response(null, { status: 204, headers: cors })
        : json({ error: "Origin not allowed" }, 403);
    }
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ service: "TLCE Integration API", status: "ok", timestamp: new Date().toISOString() }, 200, cors);
    }
    if (origin && origin !== env.TLCE_ORIGIN) return json({ error: "Origin not allowed" }, 403, cors);

    if (url.pathname === "/api/search" && request.method === "GET") {
      const identity = await requireIdentity(request, env);
      if ("response" in identity) return jsonFromResponse(identity.response, cors);
      const query = url.searchParams.get("q") ?? "";
      if (query.trim().length < 2 || query.length > MAX_QUERY_LENGTH) return json({ error: "Query must contain 2–240 characters" }, 400, cors);
      try {
        const result = await searchWeb(query, {
          braveApiKey: env.BRAVE_SEARCH_API_KEY,
          enablePublicProviders: true,
          maxResults: 8,
          timeoutMs: 6000,
        });
        return json(result, 200, cors);
      } catch {
        return json({ error: "Search request failed" }, 502, cors);
      }
    }

    if (url.pathname === "/api/ai/chat" && request.method === "POST") {
      const identity = await requireIdentity(request, env);
      if ("response" in identity) return jsonFromResponse(identity.response, cors);
      let body: { prompt?: unknown };
      try { body = await request.json() as { prompt?: unknown }; } catch { return json({ error: "Invalid JSON body" }, 400, cors); }
      if (typeof body.prompt !== "string" || body.prompt.trim().length < 1 || body.prompt.length > MAX_PROMPT_LENGTH) {
        return json({ error: "prompt must contain 1–8000 characters" }, 400, cors);
      }
      try {
        const answer = await runAi(body.prompt.trim(), env);
        return json({ provider: env.AI_PROVIDER ?? "workers-ai", answer }, 200, cors);
      } catch {
        return json({ error: "AI provider unavailable or not configured" }, 502, cors);
      }
    }

    if (url.pathname === "/api/files/upload" && request.method === "POST") {
      const identity = await requireIdentity(request, env);
      if ("response" in identity) return jsonFromResponse(identity.response, cors);
      try { return await uploadToQuarantine(request, env, identity.subject).then((response) => withCors(response, cors)); }
      catch { return json({ error: "File upload failed" }, 502, cors); }
    }

    return json({ error: "Not found" }, 404, cors);
  },

  async scheduled(controller: { cron: string; scheduledTime: number }, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }): Promise<void> {
    if (!env.AUTOMATION_WEBHOOK_URL || !env.AUTOMATION_WEBHOOK_SECRET) return;
    ctx.waitUntil(fetch(env.AUTOMATION_WEBHOOK_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.AUTOMATION_WEBHOOK_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ source: "tlce-cron", cron: controller.cron, scheduledTime: controller.scheduledTime }),
      signal: AbortSignal.timeout(10_000),
    }).then((response) => {
      if (!response.ok) throw new Error("Automation webhook failed");
    }));
  },
};
function jsonFromResponse(response: Response, extra: Record<string, string>): Response {
  return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...extra } });
}
function withCors(response: Response, extra: Record<string, string>): Response {
  return new Response(response.body, { status: response.status, headers: { ...Object.fromEntries(response.headers), ...extra } });
}

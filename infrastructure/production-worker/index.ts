import { searchWeb } from "../search/search-engine.js";

interface Env {
  TLCE_ORIGIN: string;
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  BRAVE_SEARCH_API_KEY?: string;
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

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const MAX_QUERY_LENGTH = 240;
let cachedJwks: { expiresAt: number; keys: JsonWebKey[] } | undefined;

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...extra },
  });
}
function corsHeaders(origin: string, allowedOrigin: string): Record<string, string> {
  if (origin !== allowedOrigin) return {};
  return { "access-control-allow-origin": allowedOrigin, "access-control-allow-credentials": "true", "access-control-allow-methods": "GET, OPTIONS", "access-control-allow-headers": "content-type", "vary": "Origin" };
}
function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function decodeJsonPart(value: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Record<string, unknown>;
}
async function getJwks(teamDomain: string): Promise<JsonWebKey[]> {
  if (cachedJwks && cachedJwks.expiresAt > Date.now()) return cachedJwks.keys;
  const response = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Access keyset unavailable");
  const payload = await response.json() as { keys?: JsonWebKey[] };
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
    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = decodeBase64Url(parts[2]!);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signingInput) ? claims.sub : null;
  } catch {
    return null;
  }
}
async function consumeRateLimit(env: Env, subject: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(subject));
  const key = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const id = env.RATE_LIMITER.idFromName(key);
  const response = await env.RATE_LIMITER.get(id).fetch("https://rate-limit.internal/consume", { method: "POST" });
  return response.ok && (await response.json() as { allowed?: boolean }).allowed === true;
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
    if (url.pathname !== "/api/search") return json({ error: "Not found" }, 404, cors);
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405, cors);
    if (origin && origin !== env.TLCE_ORIGIN) return json({ error: "Origin not allowed" }, 403);
    if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) return json({ error: "Identity provider is not configured" }, 503, cors);
    const assertion = request.headers.get("cf-access-jwt-assertion");
    if (!assertion) return json({ error: "Authentication required" }, 401, cors);
    const subject = await verifyAccessJwt(assertion, env);
    if (!subject) return json({ error: "Invalid identity assertion" }, 401, cors);
    try {
      if (!await consumeRateLimit(env, subject)) return json({ error: "Rate limit exceeded" }, 429, cors);
    } catch {
      return json({ error: "Rate limit service unavailable" }, 503, cors);
    }
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
  },
};

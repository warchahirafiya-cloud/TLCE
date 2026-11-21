import { searchWeb } from "./search-engine.js";
import type { SearchConfig } from "./contracts.js";

export interface SearchSecurityPolicy {
  authenticate(request: Request): Promise<boolean>;
  allowRequest(request: Request): Promise<boolean>;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

/** Search API handler. It fails closed until host identity and shared rate limiting are configured. */
export function createSearchHandler(
  config: SearchConfig,
  security?: SearchSecurityPolicy,
  fetchImpl: typeof fetch = fetch,
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!security) return json({ error: "Search security is not configured" }, 503);
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
    try {
      if (!await security.authenticate(request)) return json({ error: "Authentication required" }, 401);
      if (!await security.allowRequest(request)) return json({ error: "Rate limit exceeded" }, 429);
    } catch {
      return json({ error: "Search security service unavailable" }, 503);
    }
    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).origin !== new URL(request.url).origin) return json({ error: "Cross-origin requests are not allowed" }, 403);
      } catch { return json({ error: "Invalid request origin" }, 403); }
    }
    const query = new URL(request.url).searchParams.get("q") ?? "";
    if (query.length > 240) return json({ error: "Search query is too long" }, 400);
    try {
      return json(await searchWeb(query, config, fetchImpl));
    } catch {
      return json({ error: "Invalid search query" }, 400);
    }
  };
}

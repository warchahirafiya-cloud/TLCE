import type { SearchConfig, SearchProviderId, SearchResponse, SearchResult } from "./contracts.js";

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
const DDG_ENDPOINT = "https://api.duckduckgo.com/";
const WIKIPEDIA_ENDPOINT = "https://en.wikipedia.org/w/api.php";
const DEFAULT_TIMEOUT_MS = 6_000;
const MAX_QUERY_LENGTH = 240;

function cleanText(value: unknown, max = 500): string {
  return typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch { return null; }
}

function normalizeResult(value: unknown, provider: SearchProviderId): SearchResult | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const title = cleanText(item.title, 240);
  const url = safeHttpUrl(item.url);
  const snippet = cleanText(item.snippet, 600);
  if (!title || !url) return null;
  return { title, url, snippet, provider };
}

async function fetchJson(fetchImpl: typeof fetch, url: URL, headers: HeadersInit, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { headers, signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new Error("Search provider returned a non-success response");
    const length = Number(response.headers.get("content-length") || "0");
    if (length > 1_000_000) throw new Error("Search provider response exceeded size limit");
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function searchBrave(query: string, config: SearchConfig, fetchImpl: typeof fetch, limit: number): Promise<SearchResult[]> {
  if (!config.braveApiKey?.trim()) throw new Error("Brave API key is not configured");
  const url = new URL(BRAVE_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(limit));
  const payload = await fetchJson(fetchImpl, url, {
    accept: "application/json",
    "x-subscription-token": config.braveApiKey,
  }, config.timeoutMs ?? DEFAULT_TIMEOUT_MS) as Record<string, unknown>;
  const web = payload?.web as Record<string, unknown> | undefined;
  const rows = Array.isArray(web?.results) ? web.results : [];
  return rows.map((row) => normalizeResult({
    title: (row as Record<string, unknown>)?.title,
    url: (row as Record<string, unknown>)?.url,
    snippet: (row as Record<string, unknown>)?.description,
  }, "brave")).filter((item): item is SearchResult => item !== null).slice(0, limit);
}

async function searchDuckDuckGo(query: string, fetchImpl: typeof fetch, limit: number, timeoutMs: number): Promise<SearchResult[]> {
  const url = new URL(DDG_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("no_redirect", "1");
  const payload = await fetchJson(fetchImpl, url, { accept: "application/json" }, timeoutMs) as Record<string, unknown>;
  const results: SearchResult[] = [];
  const abstractUrl = safeHttpUrl(payload.AbstractURL);
  if (abstractUrl && cleanText(payload.Heading)) {
    results.push({ title: cleanText(payload.Heading, 240), url: abstractUrl, snippet: cleanText(payload.AbstractText), provider: "duckduckgo" });
  }
  const collect = (items: unknown[]) => {
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (Array.isArray(row.Topics)) collect(row.Topics);
      else {
        const resultUrl = safeHttpUrl(row.FirstURL);
        const text = cleanText(row.Text);
        if (resultUrl && text) results.push({ title: text.split(" - ")[0].slice(0, 240), url: resultUrl, snippet: text, provider: "duckduckgo" });
      }
      if (results.length >= limit) return;
    }
  };
  if (Array.isArray(payload.RelatedTopics)) collect(payload.RelatedTopics);
  return results.slice(0, limit);
}

async function searchWikipedia(query: string, fetchImpl: typeof fetch, limit: number, timeoutMs: number): Promise<SearchResult[]> {
  const url = new URL(WIKIPEDIA_ENDPOINT);
  url.search = new URLSearchParams({ action: "opensearch", search: query, limit: String(limit), namespace: "0", format: "json", origin: "*" }).toString();
  const payload = await fetchJson(fetchImpl, url, { accept: "application/json" }, timeoutMs);
  if (!Array.isArray(payload) || !Array.isArray(payload[1]) || !Array.isArray(payload[2]) || !Array.isArray(payload[3])) return [];
  return payload[1].map((title, index) => normalizeResult({
    title,
    snippet: payload[2][index],
    url: payload[3][index],
  }, "wikipedia")).filter((item): item is SearchResult => item !== null).slice(0, limit);
}

export function getSearchProviderStatus(config: SearchConfig = {}) {
  const publicEnabled = config.enablePublicProviders !== false;
  return [
    { id: "brave" as const, mode: "api" as const, configured: Boolean(config.braveApiKey?.trim()), enabled: Boolean(config.braveApiKey?.trim()) },
    { id: "duckduckgo" as const, mode: "public" as const, configured: true, enabled: publicEnabled },
    { id: "wikipedia" as const, mode: "public" as const, configured: true, enabled: publicEnabled },
  ];
}

/** Server-side multi-provider search. Paid/keyed providers are skipped unless explicitly configured. */
export async function searchWeb(
  rawQuery: string,
  config: SearchConfig = {},
  fetchImpl: typeof fetch = fetch,
): Promise<SearchResponse> {
  if (typeof rawQuery !== "string" || rawQuery.trim().length < 2 || rawQuery.trim().length > MAX_QUERY_LENGTH) throw new Error("Search query must contain 2–240 characters");
  const query = cleanText(rawQuery, MAX_QUERY_LENGTH);
  if (!query) throw new Error("Search query must contain 2–240 characters");
  const limit = Math.max(1, Math.min(10, Math.trunc(config.maxResults ?? 5)));
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 15_000) throw new Error("Invalid search timeout");

  const tasks: Array<{ id: SearchProviderId; run: () => Promise<SearchResult[]> }> = [];
  if (config.braveApiKey?.trim()) tasks.push({ id: "brave", run: () => searchBrave(query, config, fetchImpl, limit) });
  if (config.enablePublicProviders !== false) {
    tasks.push({ id: "duckduckgo", run: () => searchDuckDuckGo(query, fetchImpl, limit, timeoutMs) });
    tasks.push({ id: "wikipedia", run: () => searchWikipedia(query, fetchImpl, limit, timeoutMs) });
  }
  const settled = await Promise.all(tasks.map(async (task) => {
    try { return { id: task.id, status: "ok" as const, results: await task.run() }; }
    catch { return { id: task.id, status: "unavailable" as const, results: [] as SearchResult[] }; }
  }));
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  for (const provider of settled) {
    for (const result of provider.results) {
      const key = result.url.replace(/\/$/, "").toLowerCase();
      if (!seen.has(key)) { seen.add(key); results.push(result); }
      if (results.length >= limit) break;
    }
  }
  const statuses = getSearchProviderStatus(config).map((provider) => ({
    id: provider.id,
    status: !provider.enabled ? "disabled" as const :
      settled.find((item) => item.id === provider.id)?.status ?? "disabled" as const,
  }));
  return {
    query,
    results,
    providers: statuses,
    partial: settled.some((item) => item.status === "unavailable") || results.length === 0,
    generatedAt: new Date().toISOString(),
  };
}

export type SearchProviderId = "brave" | "duckduckgo" | "wikipedia";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  provider: SearchProviderId;
}

export interface SearchProviderStatus {
  id: SearchProviderId;
  mode: "api" | "public";
  configured: boolean;
  enabled: boolean;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  providers: Array<{ id: SearchProviderId; status: "ok" | "unavailable" | "disabled" }>;
  partial: boolean;
  generatedAt: string;
}

export interface SearchConfig {
  braveApiKey?: string;
  enablePublicProviders?: boolean;
  maxResults?: number;
  timeoutMs?: number;
}

import { URL } from "node:url";

export interface McpConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly bindHost: string;
  readonly port: number;
  readonly publicUrl: URL;
  readonly allowedHosts: string[];
  readonly allowedOrigins: string[];
  readonly introspectionUrl: URL;
  readonly oauthClientId: string;
  readonly oauthClientSecret: string;
  readonly requiredScopes: string[];
  readonly healthScope: string;
  readonly introspectionTimeoutMs: number;
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function integer(env: NodeJS.ProcessEnv, key: string, fallback: number, min: number, max: number): number {
  const raw = env[key];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`Invalid ${key}: expected an integer between ${min} and ${max}`);
  }
  return value;
}

function csv(value: string | undefined, fallback: string[]): string[] {
  return (value ?? fallback.join(",")).split(",").map((part) => part.trim()).filter(Boolean);
}

function parseUrl(raw: string, key: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL in ${key}`);
  }
  if (url.username || url.password || url.hash) throw new Error(`${key} must not contain credentials or a fragment`);
  return url;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const nodeEnv = env.NODE_ENV ?? "development";
  if (nodeEnv !== "development" && nodeEnv !== "test" && nodeEnv !== "production") {
    throw new Error("NODE_ENV must be development, test, or production");
  }

  const publicUrl = parseUrl(required(env, "MCP_PUBLIC_URL"), "MCP_PUBLIC_URL");
  const introspectionUrl = parseUrl(required(env, "MCP_OAUTH_INTROSPECTION_URL"), "MCP_OAUTH_INTROSPECTION_URL");
  if (nodeEnv === "production" && (publicUrl.protocol !== "https:" || introspectionUrl.protocol !== "https:")) {
    throw new Error("Production MCP public and OAuth introspection URLs must use HTTPS");
  }

  const allowedHosts = csv(env.MCP_ALLOWED_HOSTS, ["127.0.0.1", "localhost"]);
  const allowedOrigins = csv(env.MCP_ALLOWED_ORIGINS, ["http://127.0.0.1:8787", "http://localhost:8787"]);
  if (!allowedHosts.includes(publicUrl.hostname)) {
    throw new Error("MCP_PUBLIC_URL hostname must be present in MCP_ALLOWED_HOSTS");
  }

  const requiredScopes = csv(env.MCP_REQUIRED_SCOPES, ["mcp:connect"]);
  if (requiredScopes.length === 0) throw new Error("At least one MCP endpoint scope is required");

  return Object.freeze({
    nodeEnv,
    bindHost: env.MCP_BIND_HOST?.trim() || "127.0.0.1",
    port: integer(env, "MCP_PORT", 8787, 1, 65535),
    publicUrl,
    allowedHosts,
    allowedOrigins,
    introspectionUrl,
    oauthClientId: required(env, "MCP_OAUTH_CLIENT_ID"),
    oauthClientSecret: required(env, "MCP_OAUTH_CLIENT_SECRET"),
    requiredScopes,
    healthScope: env.MCP_HEALTH_SCOPE?.trim() || "tlce:health:read",
    introspectionTimeoutMs: integer(env, "MCP_INTROSPECTION_TIMEOUT_MS", 3000, 250, 10000)
  });
}

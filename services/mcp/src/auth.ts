import type { AuthInfo } from "@modelcontextprotocol/server";
import type { OAuthTokenVerifier } from "@modelcontextprotocol/express";
import type { McpConfig } from "./config.js";

interface IntrospectionPayload {
  active?: unknown;
  exp?: unknown;
  client_id?: unknown;
  sub?: unknown;
  scope?: unknown;
  aud?: unknown;
}

export function audienceMatches(aud: unknown, expected: URL): boolean {
  const values = typeof aud === "string" ? [aud] : Array.isArray(aud) ? aud : [];
  return values.some((value) => {
    if (typeof value !== "string") return false;
    try {
      const actual = new URL(value);
      return actual.origin === expected.origin &&
        actual.pathname.replace(/\/$/, "") === expected.pathname.replace(/\/$/, "") &&
        actual.search === expected.search;
    } catch {
      return false;
    }
  });
}

export function parseScopes(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/\s+/).filter((scope) => /^[\x21-\x7E]+$/.test(scope)))];
}

async function readBoundedJson(response: Response, limit = 16_384): Promise<IntrospectionPayload> {
  if (!response.body) throw new Error("OAuth introspection returned an empty body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new Error("OAuth introspection response exceeded the size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("OAuth introspection response must be a JSON object");
  }
  return parsed as IntrospectionPayload;
}

export function createTokenVerifier(config: McpConfig): OAuthTokenVerifier {
  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      if (!token || token.length > 8192 || /\s/.test(token)) {
        throw new Error("Invalid bearer token");
      }

      const credentials = Buffer.from(
        `${config.oauthClientId}:${config.oauthClientSecret}`,
        "utf8"
      ).toString("base64");

      const response = await fetch(config.introspectionUrl, {
        method: "POST",
        headers: {
          authorization: `Basic ${credentials}`,
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json"
        },
        body: new URLSearchParams({ token, token_type_hint: "access_token" }),
        signal: AbortSignal.timeout(config.introspectionTimeoutMs),
        redirect: "error",
        cache: "no-store"
      });

      if (!response.ok) throw new Error(`OAuth introspection failed with status ${response.status}`);
      const payload = await readBoundedJson(response);
      const now = Math.floor(Date.now() / 1000);
      if (payload.active !== true || typeof payload.exp !== "number" || !Number.isSafeInteger(payload.exp) || payload.exp <= now) {
        throw new Error("Inactive or expired access token");
      }
      if (!audienceMatches(payload.aud, config.publicUrl)) {
        throw new Error("Access token audience does not match this MCP resource");
      }

      const clientId = typeof payload.client_id === "string"
        ? payload.client_id
        : typeof payload.sub === "string" ? payload.sub : "";
      if (!clientId) throw new Error("Access token has no client identity");

      return {
        token,
        clientId,
        scopes: parseScopes(payload.scope),
        expiresAt: payload.exp,
        resource: config.publicUrl
      };
    }
  };
}

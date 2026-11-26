export interface CloudflareAccessIdentityOptions {
  /** Cloudflare Access team hostname only, without scheme or path. */
  teamDomain: string;
  /** Application-specific Access AUD tag. */
  audience: string;
  fetcher?: typeof fetch;
  nowSeconds?: () => number;
  jwksCacheTtlMs?: number;
}

export interface VerifiedCloudflareAccessIdentity {
  issuer: string;
  subject: string;
  /** Stable, issuer-namespaced key suitable for P1 owner/member/grant ID columns. */
  principalId: string;
}

interface AccessJwk extends JsonWebKey {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
}
interface CachedJwks {
  expiresAt: number;
  keys: AccessJwk[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid base64url segment");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJsonPart(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
  if (!isRecord(parsed)) throw new Error("JWT part must be a JSON object");
  return parsed;
}

/**
 * Creates a verifier for Cloudflare Access application JWTs.
 *
 * This authenticates an end-user identity only. It does not grant Space
 * membership or permissions; callers must run the Spaces ACL after resolving
 * this principal against server-side D1 records.
 */
export function createCloudflareAccessVerifier(options: CloudflareAccessIdentityOptions) {
  const teamDomain = options.teamDomain.toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(teamDomain) ||
      teamDomain.includes("..") || !teamDomain.endsWith(".cloudflareaccess.com")) {
    throw new Error("Cloudflare Access teamDomain must be a hostname without scheme or path");
  }
  if (typeof options.audience !== "string" || !options.audience.trim()) {
    throw new Error("Cloudflare Access audience is required");
  }

  const issuer = `https://${teamDomain}`;
  const fetcher = options.fetcher ?? fetch;
  const nowSeconds = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const cacheTtlMs = options.jwksCacheTtlMs ?? 5 * 60_000;
  let cached: CachedJwks | undefined;

  async function loadJwks(forceRefresh = false): Promise<AccessJwk[]> {
    const now = nowSeconds() * 1000;
    if (!forceRefresh && cached && cached.expiresAt > now) return cached.keys;

    const response = await fetcher(`${issuer}/cdn-cgi/access/certs`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Cloudflare Access JWKS request failed");
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.keys) || payload.keys.length === 0) {
      throw new Error("Cloudflare Access JWKS response is invalid");
    }
    const keys = payload.keys.filter((key): key is AccessJwk =>
      isRecord(key) && key.kty === "RSA" && typeof key.kid === "string" &&
      (!key.alg || key.alg === "RS256") && (!key.use || key.use === "sig"),
    );
    if (keys.length === 0) throw new Error("Cloudflare Access JWKS contains no usable signing keys");
    cached = { keys, expiresAt: now + cacheTtlMs };
    return keys;
  }

  return {
    async verify(token: string): Promise<VerifiedCloudflareAccessIdentity | null> {
      try {
        if (typeof token !== "string" || token.length < 32 || token.length > 8192) return null;
        const parts = token.split(".");
        if (parts.length !== 3 || parts.some((part) => !part)) return null;

        const header = decodeJsonPart(parts[0]!);
        const claims = decodeJsonPart(parts[1]!);
        if (header.alg !== "RS256" || typeof header.kid !== "string" ||
            (header.typ !== undefined && header.typ !== "JWT")) return null;

        const now = nowSeconds();
        if (claims.iss !== issuer || claims.type !== "app") return null;
        const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
        if (!audiences.includes(options.audience)) return null;

        if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp <= now ||
            typeof claims.iat !== "number" || !Number.isFinite(claims.iat) ||
            claims.iat > now + 30 || claims.exp <= claims.iat) return null;
        if (claims.nbf !== undefined &&
            (typeof claims.nbf !== "number" || !Number.isFinite(claims.nbf) || claims.nbf > now + 30)) return null;
        if (typeof claims.sub !== "string" || !claims.sub.trim() || claims.sub.length > 128) return null;

        let keys = await loadJwks();
        let jwk = keys.find((key) => key.kid === header.kid);
        // A cached keyset may be stale during Access signing-key rotation.
        if (!jwk) {
          keys = await loadJwks(true);
          jwk = keys.find((key) => key.kid === header.kid);
        }
        if (!jwk) return null;

        const publicKey = await crypto.subtle.importKey(
          "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
        );
        const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`).slice().buffer as ArrayBuffer;
        const signature = decodeBase64Url(parts[2]!).slice().buffer as ArrayBuffer;
        const valid = await crypto.subtle.verify(
          "RSASSA-PKCS1-v1_5", publicKey, signature, signingInput,
        );
        if (!valid) return null;

        const principalId = `cfaccess:${issuer}:${claims.sub}`;
        if (principalId.length > 160) return null;
        return { issuer, subject: claims.sub, principalId };
      } catch {
        return null;
      }
    },
  };
}

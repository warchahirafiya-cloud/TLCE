export interface IdentityPolicy {
  issuer: string;
  audience: string;
  clockSkewSeconds?: number;
}

export interface VerifiedIdentityClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  tenant_id: string;
  capabilities: string[];
}

export interface IdentityPrincipal {
  subject: string;
  issuer: string;
  audience: string;
  expiresAt: number;
  tenantId: string;
  capabilities: ReadonlySet<string>;
}

/** Adapter contract: implementation MUST perform cryptographic JWT/OIDC verification. */
export interface IdentityTokenVerifier {
  verify(token: string): Promise<unknown>;
}

const identifier = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/;
const capability = /^[a-z][a-z0-9._:-]{1,127}$/;

export function toIdentityPrincipal(
  value: unknown,
  policy: IdentityPolicy,
  nowSeconds = Math.floor(Date.now() / 1000),
): IdentityPrincipal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const claims = value as Partial<VerifiedIdentityClaims>;
  const skew = policy.clockSkewSeconds ?? 30;
  if (!Number.isInteger(skew) || skew < 0 || skew > 300) return null;
  if (typeof claims.sub !== "string" || !identifier.test(claims.sub)) return null;
  if (claims.iss !== policy.issuer) return null;
  if (typeof claims.aud !== "string" && !Array.isArray(claims.aud)) return null;
  const audiences = typeof claims.aud === "string" ? [claims.aud] : claims.aud;
  if (!audiences.every((item) => typeof item === "string") || !audiences.includes(policy.audience)) return null;
  if (!Number.isSafeInteger(claims.exp) || (claims.exp as number) <= nowSeconds - skew) return null;
  if (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf > nowSeconds + skew)) return null;
  if (typeof claims.tenant_id !== "string" || !identifier.test(claims.tenant_id)) return null;
  if (!Array.isArray(claims.capabilities) || claims.capabilities.length > 256 ||
      !claims.capabilities.every((item) => typeof item === "string" && capability.test(item))) return null;
  return {
    subject: claims.sub,
    issuer: claims.iss,
    audience: policy.audience,
    expiresAt: claims.exp as number,
    tenantId: claims.tenant_id,
    capabilities: new Set(claims.capabilities),
  };
}

/** Never treats decoded/unverified token content as identity. */
export async function authenticateBearerToken(
  authorization: string | undefined,
  verifier: IdentityTokenVerifier,
  policy: IdentityPolicy,
): Promise<IdentityPrincipal | null> {
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7);
  if (!token || token.length > 16_384 || /\s/.test(token)) return null;
  try {
    const verified = await verifier.verify(token);
    return toIdentityPrincipal(verified, policy);
  } catch {
    return null;
  }
}

import type { GitHubOAuthProvider } from "./github-oauth-provider.js";
import type { MfaChallengeService } from "../../../core/identity/src/mfa-challenge.js";

const START_PATH = "/auth/github/start";
const CALLBACK_PATH = "/auth/github/callback";
const VERIFY_PATH = "/auth/mfa/verify";
const MFA_COOKIE = "__Host-tlce_mfa_challenge";
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface GitHubOAuthRouteRequest {
  readonly method: string;
  readonly url: string;
  readonly headers?: Readonly<Record<string, string | undefined>>;
  readonly body?: string;
}
export interface GitHubOAuthRouteResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}
export interface GitHubOAuthRoutesOptions {
  readonly provider: Pick<GitHubOAuthProvider, "start" | "complete">;
  readonly mfaChallenges: Pick<MfaChallengeService, "complete">;
  readonly allowedOrigins: ReadonlyArray<string>;
  readonly successPath?: string;
  readonly mfaPath?: string;
}
export class GitHubOAuthRoutes {
  private readonly successPath: string;
  private readonly mfaPath: string;
  private readonly allowedOrigins: ReadonlySet<string>;
  constructor(private readonly options: GitHubOAuthRoutesOptions) {
    this.successPath = options.successPath ?? "/developer-console/";
    this.mfaPath = options.mfaPath ?? "/developer-console/mfa";
    for (const path of [this.successPath, this.mfaPath]) {
      if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") ||
          /[\\u0000-\\u001f]/.test(path)) throw new Error("OAuth redirect path must be a safe local path");
    }
    this.allowedOrigins = new Set(options.allowedOrigins);
    for (const origin of this.allowedOrigins) {
      let parsed: URL;
      try { parsed = new URL(origin); } catch { throw new Error("MFA origins must be exact HTTPS origins"); }
      if (parsed.protocol !== "https:" || parsed.origin !== origin) {
        throw new Error("MFA origins must be exact HTTPS origins");
      }
    }
  }

  async handle(request: GitHubOAuthRouteRequest): Promise<GitHubOAuthRouteResponse | null> {
    const method = request.method.toUpperCase();
    let url: URL;
    try { url = new URL(request.url, "https://tlce.invalid"); }
    catch { return response(400, { error: "invalid_request" }); }

    if (method === "GET" && url.pathname === START_PATH) {
      try {
        const started = await this.options.provider.start();
        return Object.freeze({ status: 302, headers: Object.freeze({
          location: started.authorizationUrl,
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        }) });
      } catch { return response(503, { error: "authentication_unavailable" }); }
    }

    if (method === "GET" && url.pathname === CALLBACK_PATH) {
      const codes = url.searchParams.getAll("code");
      const states = url.searchParams.getAll("state");
      if (codes.length !== 1 || states.length !== 1 || !codes[0] || !states[0] ||
          url.searchParams.has("error")) return response(400, { error: "authentication_failed" });
      try {
        const completed = await this.options.provider.complete({ code: codes[0], state: states[0] });
        if (completed.kind === "mfa_required") {
          return Object.freeze({ status: 303, headers: Object.freeze({
            location: this.mfaPath,
            "set-cookie": mfaCookie(completed.challengeToken, 300),
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
          }) });
        }
        return Object.freeze({ status: 303, headers: Object.freeze({
          location: this.successPath,
          "set-cookie": completed.cookie,
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        }) });
      } catch {
        return response(401, { error: "authentication_failed" });
      }
    }

    if (url.pathname === VERIFY_PATH) {
      if (method !== "POST") return response(405, { error: "method_not_allowed" }, { allow: "POST" });
      return this.verifyMfa(request);
    }
    return null;
  }

  private async verifyMfa(request: GitHubOAuthRouteRequest): Promise<GitHubOAuthRouteResponse> {
    const origin = getHeader(request.headers, "origin");
    if (!origin || !this.allowedOrigins.has(origin)) return response(403, { error: "untrusted_origin" });
    const contentType = getHeader(request.headers, "content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "application/json" || typeof request.body !== "string" || request.body.length > 1024) {
      return response(400, { error: "invalid_request" });
    }
    const token = readCookie(getHeader(request.headers, "cookie"), MFA_COOKIE);
    if (!token) return response(401, { error: "mfa_challenge_required" }, { "set-cookie": clearMfaCookie() });
    let payload: unknown;
    try { payload = JSON.parse(request.body); } catch { return response(400, { error: "invalid_request" }); }
    if (!isObject(payload) || Object.keys(payload).length !== 1 ||
        typeof payload.code !== "string" || !/^\\d{6}$/.test(payload.code)) {
      return response(400, { error: "invalid_request" });
    }
    try {
      const completed = await this.options.mfaChallenges.complete(token, payload.code);
      return Object.freeze({ status: 204, headers: Object.freeze({
        "cache-control": "no-store",
        "set-cookie": `${completed.session.cookie}, ${clearMfaCookie()}`,
      }) });
    } catch {
      // Keep the short-lived cookie for remaining attempts; the server enforces the attempt cap.
      return response(401, { error: "mfa_verification_failed" });
    }
  }
}
function mfaCookie(token: string, maxAge: number): string {
  if (!TOKEN_PATTERN.test(token)) throw new Error("Invalid MFA challenge token");
  return `${MFA_COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`;
}
function clearMfaCookie(): string {
  return `${MFA_COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`;
}
function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const values: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator >= 0 && part.slice(0, separator).trim() === name) values.push(part.slice(separator + 1).trim());
  }
  return values.length === 1 && TOKEN_PATTERN.test(values[0]) ? values[0] : null;
}
function getHeader(headers: Readonly<Record<string, string | undefined>> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function response(status: number, payload: unknown, extra: Readonly<Record<string, string>> = {}): GitHubOAuthRouteResponse {
  return Object.freeze({
    status,
    headers: Object.freeze({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      ...extra,
    }),
    body: JSON.stringify(payload),
  });
}

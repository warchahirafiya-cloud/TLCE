import type {
  GitHubOAuthProvider,
} from "./github-oauth-provider.js";

const START_PATH = "/auth/github/start";
const CALLBACK_PATH = "/auth/github/callback";

export interface GitHubOAuthRouteRequest {
  readonly method: string;
  readonly url: string;
}

export interface GitHubOAuthRouteResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: string;
}

export interface GitHubOAuthRoutesOptions {
  readonly provider: Pick<GitHubOAuthProvider, "start" | "complete">;
  /** Fixed local path; external redirect targets are never accepted from the request. */
  readonly successPath?: string;
}

/** Minimal server-side HTTP route adapter for the GitHub OAuth provider. */
export class GitHubOAuthRoutes {
  private readonly successPath: string;

  constructor(private readonly options: GitHubOAuthRoutesOptions) {
    this.successPath = options.successPath ?? "/developer-console/";
    if (!this.successPath.startsWith("/") || this.successPath.startsWith("//") ||
        this.successPath.includes("\\") || /[\\u0000-\\u001f]/.test(this.successPath)) {
      throw new Error("OAuth success path must be a safe local path");
    }
  }

  async handle(request: GitHubOAuthRouteRequest): Promise<GitHubOAuthRouteResponse | null> {
    if (request.method.toUpperCase() !== "GET") return null;
    let url: URL;
    try {
      url = new URL(request.url, "https://tlce.invalid");
    } catch {
      return response(400, { error: "invalid_request" });
    }

    if (url.pathname === START_PATH) {
      try {
        const started = await this.options.provider.start();
        return Object.freeze({
          status: 302,
          headers: Object.freeze({
            location: started.authorizationUrl,
            "cache-control": "no-store",
            "referrer-policy": "no-referrer",
          }),
        });
      } catch {
        return response(503, { error: "authentication_unavailable" });
      }
    }

    if (url.pathname !== CALLBACK_PATH) return null;
    const codes = url.searchParams.getAll("code");
    const states = url.searchParams.getAll("state");
    if (codes.length !== 1 || states.length !== 1 || !codes[0] || !states[0] ||
        url.searchParams.has("error")) {
      return response(400, { error: "authentication_failed" });
    }

    try {
      const completed = await this.options.provider.complete({
        code: codes[0],
        state: states[0],
      });
      return Object.freeze({
        status: 303,
        headers: Object.freeze({
          location: this.successPath,
          "set-cookie": completed.cookie,
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        }),
      });
    } catch {
      // Never reflect provider errors, authorization codes, state or access tokens.
      return response(401, { error: "authentication_failed" });
    }
  }
}

function response(status: number, payload: unknown): GitHubOAuthRouteResponse {
  return Object.freeze({
    status,
    headers: Object.freeze({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    }),
    body: JSON.stringify(payload),
  });
}

import {
  resolveLinkedExternalIdentity,
  type ExternalAccountLinkStore,
} from "../../../core/identity/src/external-identity.js";
import { OAuthTransactionService } from "../../../core/identity/src/oauth-transaction.js";
import { OperatorSessionService } from "../../../core/identity/src/operator-session.js";
import { MfaChallengeService } from "../../../core/identity/src/mfa-challenge.js";
import type { OperatorRole } from "../../../core/identity/src/operator-authorization.js";

const AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";
const PRIVILEGED_ROLES = new Set<OperatorRole>(["operator", "maintainer", "security_admin"]);

export interface OAuthHttpResponse {
  readonly status: number;
  json(): Promise<unknown>;
}
export interface OAuthHttpClient {
  post(url: string, headers: Readonly<Record<string, string>>, body: string): Promise<OAuthHttpResponse>;
  get(url: string, headers: Readonly<Record<string, string>>): Promise<OAuthHttpResponse>;
}
export interface GitHubOAuthPolicy {
  readonly roles: ReadonlyArray<OperatorRole>;
  readonly allowedModuleIds: ReadonlyArray<string>;
}
export interface GitHubOAuthProviderOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly http: OAuthHttpClient;
  readonly transactions: OAuthTransactionService;
  readonly accountLinks: ExternalAccountLinkStore;
  readonly sessions: OperatorSessionService;
  readonly mfaChallenges: MfaChallengeService;
  readonly resolvePolicy: (tlceSubject: string) => Promise<GitHubOAuthPolicy>;
  readonly now?: () => Date;
}
export interface StartedGitHubAuthorization {
  readonly authorizationUrl: string;
  readonly expiresAt: string;
}
export type CompletedGitHubAuthorization =
  | { readonly kind: "authenticated"; readonly cookie: string; readonly expiresAt: string }
  | { readonly kind: "mfa_required"; readonly challengeToken: string; readonly expiresAt: string };

export class GitHubOAuthProvider {
  private readonly now: () => Date;
  constructor(private readonly options: GitHubOAuthProviderOptions) {
    this.now = options.now ?? (() => new Date());
    if (!options.clientId.trim() || !options.clientSecret.trim()) {
      throw new Error("GitHub OAuth client credentials are required");
    }
    const callback = new URL(options.redirectUri);
    if (callback.protocol !== "https:" || callback.username || callback.password || callback.hash) {
      throw new Error("GitHub OAuth callback must be an exact HTTPS URL");
    }
  }

  async start(): Promise<StartedGitHubAuthorization> {
    const transaction = await this.options.transactions.create("github", this.options.redirectUri);
    const url = new URL(AUTHORIZE_ENDPOINT);
    url.searchParams.set("client_id", this.options.clientId);
    url.searchParams.set("redirect_uri", transaction.redirectUri);
    url.searchParams.set("scope", "read:user");
    url.searchParams.set("state", transaction.state);
    return Object.freeze({ authorizationUrl: url.toString(), expiresAt: transaction.expiresAt });
  }

  async complete(input: { readonly code: string; readonly state: string }): Promise<CompletedGitHubAuthorization> {
    if (typeof input.code !== "string" || input.code.length < 1 || input.code.length > 512 ||
        /[\\u0000-\\u0020]/.test(input.code)) {
      throw new Error("Invalid GitHub authorization response");
    }
    await this.options.transactions.consume("github", input.state, this.options.redirectUri);
    const tokenResponse = await this.options.http.post(TOKEN_ENDPOINT, {
      accept: "application/json",
      "content-type": "application/json",
    }, JSON.stringify({
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      code: input.code,
      redirect_uri: this.options.redirectUri,
    }));
    if (tokenResponse.status < 200 || tokenResponse.status >= 300) {
      throw new Error("GitHub authorization could not be completed");
    }
    const tokenPayload = await tokenResponse.json();
    if (!isObject(tokenPayload) || typeof tokenPayload.access_token !== "string" ||
        tokenPayload.access_token.length < 1 || tokenPayload.access_token.length > 4096 ||
        typeof tokenPayload.token_type !== "string" || tokenPayload.token_type.toLowerCase() !== "bearer" ||
        tokenPayload.error) {
      throw new Error("GitHub returned an invalid token response");
    }
    const profileResponse = await this.options.http.get(USER_ENDPOINT, {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${tokenPayload.access_token}`,
      "x-github-api-version": "2022-11-28",
    });
    if (profileResponse.status < 200 || profileResponse.status >= 300) {
      throw new Error("GitHub account verification failed");
    }
    const profile = await profileResponse.json();
    if (!isObject(profile) || !Number.isSafeInteger(profile.id) ||
        typeof profile.id !== "number" || profile.id <= 0) {
      throw new Error("GitHub returned an invalid account identity");
    }
    const verifiedIdentity = await resolveLinkedExternalIdentity({
      provider: "github",
      providerSubject: String(profile.id),
      verifiedAt: this.now().toISOString(),
    }, this.options.accountLinks);
    const policy = await this.options.resolvePolicy(verifiedIdentity.subject);
    if (!Array.isArray(policy.roles) || policy.roles.length === 0 ||
        !Array.isArray(policy.allowedModuleIds)) {
      throw new Error("TLCE operator policy is unavailable");
    }

    if (policy.roles.some((role) => PRIVILEGED_ROLES.has(role))) {
      const challenge = await this.options.mfaChallenges.begin({
        subject: verifiedIdentity.subject,
        roles: policy.roles,
        allowedModuleIds: policy.allowedModuleIds,
      });
      return Object.freeze({
        kind: "mfa_required",
        challengeToken: challenge.challengeToken,
        expiresAt: challenge.expiresAt,
      });
    }

    const session = await this.options.sessions.createSession({
      subject: verifiedIdentity.subject,
      roles: policy.roles,
      allowedModuleIds: policy.allowedModuleIds,
    });
    return Object.freeze({ kind: "authenticated", cookie: session.cookie, expiresAt: session.expiresAt });
  }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

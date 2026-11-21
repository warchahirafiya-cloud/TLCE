import type { ControlPlaneReadModel } from "../../../core/control-plane/src/developer-console.js";
import type { OperatorRole } from "../../../core/identity/src/operator-authorization.js";
import type { TotpFactorVerifier } from "../../../core/identity/src/mfa-challenge.js";
import type { OAuthHttpClient } from "./github-oauth-provider.js";
import {
  DeveloperConsoleGateway,
  type GatewayRequest,
  type GatewayResponse,
} from "./developer-console-gateway.js";
import { GitHubOAuthProvider } from "./github-oauth-provider.js";
import { GitHubOAuthRoutes } from "./github-oauth-routes.js";
import { OperatorSessionService } from "../../../core/identity/src/operator-session.js";
import { OAuthTransactionService } from "../../../core/identity/src/oauth-transaction.js";
import { MfaChallengeService } from "../../../core/identity/src/mfa-challenge.js";
import { DeveloperConsoleService } from "../../../core/control-plane/src/developer-console.js";
import { PostgresAuditSink } from "../../persistence/postgres/src/postgres-audit-sink.js";
import {
  PostgresOperatorSessionStore,
  type PostgresQueryExecutor,
} from "../../persistence/postgres/src/postgres-operator-session-store.js";
import { PostgresExternalAccountLinkStore } from "../../persistence/postgres/src/postgres-external-account-link-store.js";
import { PostgresOAuthTransactionStore } from "../../persistence/postgres/src/postgres-oauth-transaction-store.js";
import { PostgresMfaChallengeStore } from "../../persistence/postgres/src/postgres-mfa-challenge-store.js";

export interface TlceDeveloperConsoleRuntimeOptions {
  readonly database: PostgresQueryExecutor;
  readonly readModel: ControlPlaneReadModel;
  readonly oauthHttp: OAuthHttpClient;
  readonly githubClientId: string;
  readonly githubClientSecret: string;
  readonly githubRedirectUri: string;
  readonly allowedOrigins: ReadonlyArray<string>;
  /** Mandatory production verifier backed by encrypted enrolled TOTP factors and replay protection. */
  readonly totpVerifier: TotpFactorVerifier;
  readonly resolveOperatorPolicy: (subject: string) => Promise<{
    readonly roles: ReadonlyArray<OperatorRole>;
    readonly allowedModuleIds: ReadonlyArray<string>;
  }>;
  readonly successPath?: string;
  readonly mfaPath?: string;
  readonly now?: () => number;
  readonly nowDate?: () => Date;
  readonly createRequestId?: () => string;
}

export function createTlceDeveloperConsoleRuntime(options: TlceDeveloperConsoleRuntimeOptions): {
  handle(request: GatewayRequest): Promise<GatewayResponse>;
} {
  const sessionStore = new PostgresOperatorSessionStore(options.database);
  const auditSink = new PostgresAuditSink(options.database);
  const externalLinks = new PostgresExternalAccountLinkStore(options.database);
  const oauthTransactionStore = new PostgresOAuthTransactionStore(options.database);
  const mfaStore = new PostgresMfaChallengeStore(options.database);
  const sessions = new OperatorSessionService({
    store: sessionStore,
    ...(options.now ? { now: options.now } : {}),
  });
  const transactions = new OAuthTransactionService({
    store: oauthTransactionStore,
    ...(options.now ? { now: options.now } : {}),
  });
  const mfaChallenges = new MfaChallengeService({
    store: mfaStore,
    sessions,
    verifier: options.totpVerifier,
    ...(options.now ? { now: options.now } : {}),
  });
  const consoleService = new DeveloperConsoleService({
    readModel: options.readModel,
    auditSink,
    ...(options.nowDate ? { now: options.nowDate } : {}),
  });
  const provider = new GitHubOAuthProvider({
    clientId: options.githubClientId,
    clientSecret: options.githubClientSecret,
    redirectUri: options.githubRedirectUri,
    http: options.oauthHttp,
    transactions,
    accountLinks: externalLinks,
    sessions,
    mfaChallenges,
    resolvePolicy: options.resolveOperatorPolicy,
    ...(options.nowDate ? { now: options.nowDate } : {}),
  });
  const oauthRoutes = new GitHubOAuthRoutes({
    provider,
    mfaChallenges,
    allowedOrigins: options.allowedOrigins,
    ...(options.successPath ? { successPath: options.successPath } : {}),
    ...(options.mfaPath ? { mfaPath: options.mfaPath } : {}),
  });
  const gateway = new DeveloperConsoleGateway({
    sessions,
    console: consoleService,
    allowedOrigins: options.allowedOrigins,
    ...(options.createRequestId ? { createRequestId: options.createRequestId } : {}),
  });
  return Object.freeze({
    async handle(request: GatewayRequest): Promise<GatewayResponse> {
      const oauthResponse = await oauthRoutes.handle({
        method: request.method,
        url: request.url,
        headers: request.headers,
        ...(request.body !== undefined ? { body: request.body } : {}),
      });
      if (oauthResponse) return oauthResponse;
      return gateway.handle(request);
    },
  });
}

import { randomUUID } from "node:crypto";
import {
  clearOperatorSessionCookie,
  OperatorSessionService,
  type ResolvedOperatorSession,
} from "../../../core/identity/src/operator-session.js";
import {
  ConsoleAccessDeniedError,
  DeveloperConsoleService,
} from "../../../core/control-plane/src/developer-console.js";

const SESSION_COOKIE = "__Host-tlce_session";
const CSRF_HEADER = "x-tlce-csrf";
const SESSION_PATH = "/api/tlce/control-plane/session";
const OVERVIEW_PATH = "/api/tlce/control-plane/overview";
const MODULES_PATH = "/api/tlce/control-plane/modules";
const LOGOUT_PATH = "/auth/logout";

export interface GatewayRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly body?: string;
}

export interface GatewayResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | ReadonlyArray<string>>>;
  readonly body?: string;
}

export interface DeveloperConsoleGatewayOptions {
  readonly sessions: OperatorSessionService;
  readonly console: DeveloperConsoleService;
  /** Exact trusted browser origins, including scheme and port where applicable. */
  readonly allowedOrigins: ReadonlyArray<string>;
  readonly createRequestId?: () => string;
}

function json(status: number, payload: unknown, extraHeaders: Readonly<Record<string, string>> = {}): GatewayResponse {
  return Object.freeze({
    status,
    headers: Object.freeze({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extraHeaders,
    }),
    body: JSON.stringify(payload),
  });
}

function header(headers: Readonly<Record<string, string | undefined>>, name: string): string | undefined {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const values: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name === SESSION_COOKIE) values.push(part.slice(separator + 1).trim());
  }
  // Reject duplicate session cookies to avoid parser disagreement.
  if (values.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(values[0])) return null;
  return values[0];
}

function safePath(url: string): string | null {
  try {
    const parsed = new URL(url, "https://tlce.invalid");
    return parsed.pathname;
  } catch {
    return null;
  }
}

function isTrustedOrigin(origin: string | undefined, allowedOrigins: ReadonlyArray<string>): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.protocol !== "https:") return false;
    return allowedOrigins.includes(parsed.origin);
  } catch {
    return false;
  }
}

function operatorPayload(operator: ResolvedOperatorSession) {
  return Object.freeze({
    subject: operator.subject,
    roles: operator.roles,
  });
}

/**
 * Framework-neutral HTTP boundary for the private developer console.
 * Adapt this request/response contract to the selected server framework.
 * It intentionally contains no OAuth callback or provider-token handling.
 */
export class DeveloperConsoleGateway {
  private readonly createRequestId: () => string;
  private readonly allowedOrigins: ReadonlySet<string>;

  constructor(private readonly options: DeveloperConsoleGatewayOptions) {
    this.createRequestId = options.createRequestId ?? randomUUID;
    this.allowedOrigins = new Set(options.allowedOrigins);
    for (const origin of this.allowedOrigins) {
      if (!isTrustedOrigin(origin, [origin])) {
        throw new Error("Gateway origins must be exact HTTPS origins");
      }
    }
  }

  async handle(request: GatewayRequest): Promise<GatewayResponse> {
    const method = request.method.toUpperCase();
    const path = safePath(request.url);
    if (!path) return json(400, { error: "invalid_request" });
    const requestId = this.createRequestId();

    if (method === "POST" && path === LOGOUT_PATH) {
      return this.logout(request);
    }
    if (method !== "GET") return json(405, { error: "method_not_allowed" }, { allow: "GET, POST" });

    if (![SESSION_PATH, OVERVIEW_PATH, MODULES_PATH].includes(path)) {
      return json(404, { error: "not_found" });
    }

    const token = readSessionCookie(header(request.headers, "cookie"));
    if (!token) return json(401, { error: "unauthenticated" });

    const operator = await this.options.sessions.resolveSession(token);
    if (!operator) {
      return json(401, { error: "unauthenticated" }, { "set-cookie": clearOperatorSessionCookie() });
    }

    if (path === SESSION_PATH) {
      const csrfToken = await this.options.sessions.issueCsrfToken(token);
      if (!csrfToken) {
        return json(401, { error: "unauthenticated" }, { "set-cookie": clearOperatorSessionCookie() });
      }
      return json(200, {
        authenticated: true,
        operator: operatorPayload(operator),
        csrfToken,
      });
    }

    try {
      const context = {
        subject: operator.subject,
        roles: operator.roles,
        allowedModuleIds: operator.allowedModuleIds,
      };
      if (path === OVERVIEW_PATH) {
        const overview = await this.options.console.getOverview(context, requestId);
        return json(200, overview);
      }
      const modules = await this.options.console.listModules(context, requestId);
      return json(200, { modules });
    } catch (error) {
      if (error instanceof ConsoleAccessDeniedError) return json(403, { error: "forbidden" });
      return json(500, { error: "internal_error" });
    }
  }

  private async logout(request: GatewayRequest): Promise<GatewayResponse> {
    const origin = header(request.headers, "origin");
    if (!isTrustedOrigin(origin, [...this.allowedOrigins])) {
      return json(403, { error: "untrusted_origin" });
    }
    const token = readSessionCookie(header(request.headers, "cookie"));
    if (!token) {
      return Object.freeze({
        status: 204,
        headers: Object.freeze({
          "cache-control": "no-store",
          "set-cookie": clearOperatorSessionCookie(),
        }),
      });
    }
    const csrfToken = header(request.headers, CSRF_HEADER);
    if (!csrfToken || !(await this.options.sessions.validateCsrfToken(token, csrfToken))) {
      return json(403, { error: "csrf_validation_failed" });
    }
    await this.options.sessions.revokeSession(token);
    return Object.freeze({
      status: 204,
      headers: Object.freeze({
        "cache-control": "no-store",
        "set-cookie": clearOperatorSessionCookie(),
      }),
    });
  }
}

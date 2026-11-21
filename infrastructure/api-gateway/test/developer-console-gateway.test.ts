import test from "node:test";
import assert from "node:assert/strict";
import {
  DeveloperConsoleGateway,
  type GatewayRequest,
} from "../src/developer-console-gateway.js";
import {
  OperatorSessionService,
  type OperatorSessionRecord,
  type OperatorSessionStore,
} from "../../../core/identity/src/operator-session.js";
import {
  DeveloperConsoleService,
  type ConsoleModuleSummary,
} from "../../../core/control-plane/src/developer-console.js";
import type { AuditRecord, AuditSink } from "../../../core/audit/src/audit.js";

class MemorySessionStore implements OperatorSessionStore {
  records = new Map<string, OperatorSessionRecord>();
  async create(record: OperatorSessionRecord) { this.records.set(record.sessionTokenHash, record); }
  async find(hash: string) { return this.records.get(hash) ?? null; }
  async replace(record: OperatorSessionRecord) { this.records.set(record.sessionTokenHash, record); }
  async delete(hash: string) { this.records.delete(hash); }
}

class MemoryAuditSink implements AuditSink {
  records: AuditRecord[] = [];
  async write(record: AuditRecord) { this.records.push(record); }
}

function fixture() {
  const store = new MemorySessionStore();
  let tokenIndex = 0;
  const tokens = ["s", "c", "r"].map((value) => value.repeat(43));
  const sessions = new OperatorSessionService({
    store,
    now: () => 1_800_000_000_000,
    randomToken: () => tokens[tokenIndex++],
    absoluteTtlMs: 60 * 60_000,
    idleTtlMs: 15 * 60_000,
  });
  const audit = new MemoryAuditSink();
  const modules: ConsoleModuleSummary[] = [
    { moduleId: "store", displayName: "TLCE Store", version: "1.0.0", state: "ready" },
    { moduleId: "questpulse", displayName: "QuestPulse", version: "0.1.0", state: "ready" },
  ];
  const consoleService = new DeveloperConsoleService({
    readModel: {
      async getOverview() {
        return { registeredModules: 2, readyModules: 2, degradedModules: 0, failedModules: 0 };
      },
      async listModules() { return modules; },
    },
    auditSink: audit,
    now: () => new Date("2026-11-21T10:00:00.000Z"),
    createId: () => "audit-123",
  });
  const gateway = new DeveloperConsoleGateway({
    sessions,
    console: consoleService,
    allowedOrigins: ["https://console.tlce.store"],
    createRequestId: () => "request-123",
  });
  const cookie = (token: string) => `__Host-tlce_session=${token}`;
  const request = (method: string, url: string, headers: Record<string, string> = {}): GatewayRequest =>
    ({ method, url, headers });
  return { sessions, gateway, audit, cookie, request };
}

test("rejects anonymous console API access", async () => {
  const { gateway, request } = fixture();
  const response = await gateway.handle(request("GET", "/api/tlce/control-plane/overview"));
  assert.equal(response.status, 401);
  assert.deepEqual(JSON.parse(response.body!), { error: "unauthenticated" });
});

test("returns a session bootstrap payload without exposing the session token", async () => {
  const { sessions, gateway, request, cookie } = fixture();
  await sessions.createSession({ subject: "operator-1", roles: ["viewer"], allowedModuleIds: ["store"] });
  const response = await gateway.handle(request("GET", "/api/tlce/control-plane/session", {
    cookie: cookie("s".repeat(43)),
  }));
  const body = JSON.parse(response.body!);
  assert.equal(response.status, 200);
  assert.equal(body.authenticated, true);
  assert.deepEqual(body.operator, { subject: "operator-1", roles: ["viewer"] });
  assert.match(body.csrfToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(JSON.stringify(body).includes("s".repeat(43)), false);
  assert.equal(response.headers["cache-control"], "no-store");
});

test("serves overview only to a valid viewer session and writes an audit event", async () => {
  const { sessions, gateway, request, cookie, audit } = fixture();
  await sessions.createSession({ subject: "operator-2", roles: ["viewer"], allowedModuleIds: ["store"] });
  const response = await gateway.handle(request("GET", "/api/tlce/control-plane/overview", {
    cookie: cookie("s".repeat(43)),
  }));
  assert.equal(response.status, 200);
  assert.equal(JSON.parse(response.body!).readyModules, 2);
  assert.equal(audit.records.length, 1);
  assert.equal(audit.records[0].outcome, "success");
});

test("limits module results to the session's explicit module scope", async () => {
  const { sessions, gateway, request, cookie } = fixture();
  await sessions.createSession({ subject: "operator-3", roles: ["viewer"], allowedModuleIds: ["store"] });
  const response = await gateway.handle(request("GET", "/api/tlce/control-plane/modules", {
    cookie: cookie("s".repeat(43)),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body!).modules.map((item: { moduleId: string }) => item.moduleId), ["store"]);
});

test("rejects duplicate or malformed session cookies", async () => {
  const { gateway, request } = fixture();
  const duplicate = await gateway.handle(request("GET", "/api/tlce/control-plane/session", {
    cookie: `__Host-tlce_session=${"s".repeat(43)}; __Host-tlce_session=${"s".repeat(43)}`,
  }));
  const malformed = await gateway.handle(request("GET", "/api/tlce/control-plane/session", {
    cookie: "__Host-tlce_session=not-a-token",
  }));
  assert.equal(duplicate.status, 401);
  assert.equal(malformed.status, 401);
});

test("rejects logout without trusted Origin and valid CSRF token", async () => {
  const { sessions, gateway, request, cookie } = fixture();
  await sessions.createSession({ subject: "operator-4", roles: ["viewer"], allowedModuleIds: ["store"] });
  const noOrigin = await gateway.handle(request("POST", "/auth/logout", {
    cookie: cookie("s".repeat(43)),
    "x-tlce-csrf": "c".repeat(43),
  }));
  assert.equal(noOrigin.status, 403);
  const badCsrf = await gateway.handle(request("POST", "/auth/logout", {
    cookie: cookie("s".repeat(43)),
    origin: "https://console.tlce.store",
    "x-tlce-csrf": "x".repeat(43),
  }));
  assert.equal(badCsrf.status, 403);
  assert.notEqual(await sessions.resolveSession("s".repeat(43)), null);
});

test("revokes a session only after Origin and CSRF validation", async () => {
  const { sessions, gateway, request, cookie } = fixture();
  await sessions.createSession({ subject: "operator-5", roles: ["viewer"], allowedModuleIds: ["store"] });
  const logout = await gateway.handle(request("POST", "/auth/logout", {
    cookie: cookie("s".repeat(43)),
    origin: "https://console.tlce.store",
    "x-tlce-csrf": "c".repeat(43),
  }));
  assert.equal(logout.status, 204);
  const setCookie = logout.headers["set-cookie"];
  assert.ok(setCookie);
  assert.match(typeof setCookie === "string" ? setCookie : setCookie.join("\n"), /Max-Age=0/);
  assert.equal(await sessions.resolveSession("s".repeat(43)), null);
});

test("does not serve protected data when audit persistence fails", async () => {
  const { sessions, gateway, request, cookie } = fixture();
  const failingAudit: AuditSink = { async write() { throw new Error("audit unavailable"); } };
  const protectedService = new DeveloperConsoleService({
    readModel: {
      async getOverview() { throw new Error("must not reach read model"); },
      async listModules() { return []; },
    },
    auditSink: failingAudit,
  });
  const guarded = new DeveloperConsoleGateway({
    sessions,
    console: protectedService,
    allowedOrigins: ["https://console.tlce.store"],
  });
  await sessions.createSession({ subject: "operator-6", roles: ["viewer"], allowedModuleIds: ["store"] });
  const response = await guarded.handle(request("GET", "/api/tlce/control-plane/overview", {
    cookie: cookie("s".repeat(43)),
  }));
  assert.equal(response.status, 500);
});

test("rejects unknown paths and non-GET methods", async () => {
  const { gateway, request } = fixture();
  assert.equal((await gateway.handle(request("GET", "/private"))).status, 404);
  assert.equal((await gateway.handle(request("PUT", "/api/tlce/control-plane/session"))).status, 405);
});

test("requires configured HTTPS origins", () => {
  const { sessions } = fixture();
  assert.throws(() => new DeveloperConsoleGateway({
    sessions,
    console: new DeveloperConsoleService({
      readModel: { async getOverview() { return { registeredModules: 0, readyModules: 0, degradedModules: 0, failedModules: 0 }; }, async listModules() { return []; } },
      auditSink: new MemoryAuditSink(),
    }),
    allowedOrigins: ["http://localhost:3000"],
  }), /HTTPS/);
});

import test from "node:test";
import assert from "node:assert/strict";
import { DeveloperConsoleService, ConsoleAccessDeniedError, type ConsoleModuleSummary } from "../src/developer-console";
import type { AuditRecord, AuditSink } from "../../audit/src/audit";

const modules: ReadonlyArray<ConsoleModuleSummary> = [
  { moduleId: "quest-pulse", displayName: "QuestPulse", version: "0.1.0", state: "ready" },
  { moduleId: "llm7-chat", displayName: "LLM7 Chat", version: "0.1.0", state: "stopped" },
];

function setup() {
  const records: AuditRecord[] = [];
  const reads = { overview: 0, modules: 0 };
  const auditSink: AuditSink = { write: async (record) => { records.push(record); } };
  const service = new DeveloperConsoleService({
    auditSink,
    readModel: {
      getOverview: async () => { reads.overview++; return { registeredModules: 2, readyModules: 1, degradedModules: 0, failedModules: 0 }; },
      listModules: async () => { reads.modules++; return modules; },
    },
    now: () => new Date("2026-11-18T00:00:00.000Z"),
    createId: () => "audit-001",
  });
  return { service, records, reads };
}

test("anonymous callers are denied and denial is audited before returning", async () => {
  const { service, records, reads } = setup();
  await assert.rejects(service.getOverview(null, "req-1"), ConsoleAccessDeniedError);
  assert.equal(reads.overview, 0);
  assert.equal(records.length, 1);
  assert.equal(records[0].outcome, "denied");
  assert.equal(records[0].actorId, "anonymous");
});

test("verified viewer can read overview and the read is audited", async () => {
  const { service, records, reads } = setup();
  const result = await service.getOverview({ subject: "operator-1", roles: ["viewer"], allowedModuleIds: ["quest-pulse"] }, "req-2");
  assert.equal(result.registeredModules, 2);
  assert.equal(reads.overview, 1);
  assert.equal(records[0].outcome, "success");
  assert.equal(records[0].actorId, "operator-1");
});

test("module registry is filtered to the operator's explicit module scope", async () => {
  const { service } = setup();
  const result = await service.listModules({ subject: "operator-2", roles: ["viewer"], allowedModuleIds: ["quest-pulse"] }, "req-3");
  assert.deepEqual(result.map((module) => module.moduleId), ["quest-pulse"]);
});

test("empty module scope returns no modules", async () => {
  const { service } = setup();
  const result = await service.listModules({ subject: "operator-3", roles: ["viewer"], allowedModuleIds: [] }, "req-4");
  assert.deepEqual(result, []);
});

test("audit persistence failure blocks console data access", async () => {
  let readCount = 0;
  const service = new DeveloperConsoleService({
    auditSink: { write: async () => { throw new Error("audit storage unavailable"); } },
    readModel: {
      getOverview: async () => { readCount++; return { registeredModules: 0, readyModules: 0, degradedModules: 0, failedModules: 0 }; },
      listModules: async () => [],
    },
  });
  await assert.rejects(service.getOverview({ subject: "operator-4", roles: ["viewer"], allowedModuleIds: [] }, "req-5"), /audit storage unavailable/);
  assert.equal(readCount, 0);
});

test("rejects malformed request identifiers before reading data", async () => {
  const { service, reads } = setup();
  await assert.rejects(service.getOverview({ subject: "operator-5", roles: ["viewer"], allowedModuleIds: [] }, "bad id"), /Invalid request id/);
  assert.equal(reads.overview, 0);
});

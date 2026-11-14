import test from "node:test";
import assert from "node:assert/strict";
import { createAuditRecord } from "../src/audit";

const base = {
  auditId: "audit-001", occurredAt: "2026-11-14T00:00:00.000Z",
  requestId: "req-001", actorId: "user-001", actorType: "user" as const,
  moduleId: "quest-pulse", action: "profile.read", resourceType: "profile",
  resourceId: "profile-001", outcome: "success" as const,
};

test("creates an immutable audit record with safe metadata", () => {
  const record = createAuditRecord({ ...base, metadata: { source: "web", result: "cached" } });
  assert.equal(record.metadata.source, "web");
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.metadata), true);
});

test("rejects secret-bearing metadata keys", () => {
  for (const key of ["access_token", "password", "authorization", "private_key", "cookie"]) {
    assert.throws(() => createAuditRecord({ ...base, metadata: { [key]: "do-not-log" } }), /prohibited/);
  }
});

test("rejects unbounded metadata and invalid identifiers", () => {
  assert.throws(() => createAuditRecord({ ...base, metadata: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, "v"])) }), /20-field/);
  assert.throws(() => createAuditRecord({ ...base, requestId: "bad request id" }), /request id/);
  assert.throws(() => createAuditRecord({ ...base, occurredAt: "yesterday" }), /timestamp/);
  assert.throws(() => createAuditRecord({ ...base, metadata: { source: "x".repeat(257) } }), /bounded/);
});

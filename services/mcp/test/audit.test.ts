import test from "node:test";
import assert from "node:assert/strict";
import { assertProductionAuditSink, stdoutAuditSink, type AuditSink } from "../src/audit.js";

test("stdout audit sink is explicitly non-durable", () => {
  assert.equal(stdoutAuditSink.durable, false);
});

test("production startup rejects the development stdout sink", () => {
  assert.throws(
    () => assertProductionAuditSink(stdoutAuditSink, "production"),
    /requires a durable TLCE Core audit sink/
  );
});

test("production startup accepts an explicitly durable Core adapter", () => {
  const coreSink: AuditSink = { durable: true, async write() {} };
  assert.doesNotThrow(() => assertProductionAuditSink(coreSink, "production"));
});

test("non-production startup can use the development sink", () => {
  assert.doesNotThrow(() => assertProductionAuditSink(stdoutAuditSink, "development"));
});

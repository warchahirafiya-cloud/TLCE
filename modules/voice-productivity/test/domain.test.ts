import test from "node:test";
import assert from "node:assert/strict";
import { createProductivityDraft } from "../src/domain.js";
const capture = { transcript: "Build a landing page for the new product", capturedAt: "2026-11-14T12:00:00.000Z", source: "manual" as const };
test("creates reviewable software task drafts without execution", () => {
  const result = createProductivityDraft(capture, "software-task", { projectId: "p-1", taskIds: ["t-1", "t-2", "t-3"] });
  assert.equal(result.tasks.length, 3); assert.equal(result.executionEnabled, false); assert.equal(result.requiresApproval, true);
  assert.ok(result.tasks.every(t => t.status === "draft" && t.requiresApproval));
});
test("creates project draft with staged tasks", () => {
  const result = createProductivityDraft(capture, "create-project", { projectId: "p-1", taskIds: ["t-1", "t-2", "t-3", "t-4"] });
  assert.equal(result.project?.status, "draft"); assert.equal(result.project?.tasks.length, 4); assert.equal(result.tasks.length, 0);
});
test("rejects empty transcripts and insufficient task IDs", () => {
  assert.throws(() => createProductivityDraft({ ...capture, transcript: "  " }, "capture-idea", { projectId: "p-1", taskIds: [] }));
  assert.throws(() => createProductivityDraft(capture, "marketing-task", { projectId: "p-1", taskIds: ["t-1"] }));
});
test("captures an idea without inventing tasks", () => {
  const result = createProductivityDraft(capture, "capture-idea", { projectId: "p-1", taskIds: [] });
  assert.equal(result.normalizedIdea, capture.transcript); assert.equal(result.project, null); assert.deepEqual(result.tasks, []);
});

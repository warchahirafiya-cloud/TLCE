import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { TlceEvent } from "../contracts/events.js";
import { ZapierEventConsumer } from "./zapier-event-consumer.js";

const baseEvent: TlceEvent<{ submissionRef: string; status: "pending"; email: string }> = {
  eventId: "evt-123",
  eventType: "qp.submission.received.v1",
  schemaVersion: 1,
  occurredAt: "2026-11-14T10:00:00.000Z",
  producerModule: "questpulse",
  idempotencyKey: "submission-ref-123",
  payload: { submissionRef: "sub-opaque-123", status: "pending", email: "must-not-leak@example.invalid" },
};

const secret = "test-signing-secret-with-at-least-32-characters";

function makeConsumer(fetchImpl: typeof fetch, overrides: Record<string, unknown> = {}) {
  return new ZapierEventConsumer({
    hookUrl: "https://hooks.zapier.com/hooks/catch/test/test-token/",
    signingSecret: secret,
    fetchImpl,
    now: () => new Date("2026-11-14T10:00:05.000Z"),
    ...overrides,
  });
}

test("posts only allowlisted fields and signs the exact request body", async () => {
  let request: Request | undefined;
  const consumer = makeConsumer(async (input, init) => {
    request = new Request(input, init);
    return new Response("ok", { status: 200 });
  });
  await consumer.handle(baseEvent);

  assert.ok(request);
  const body = await request.text();
  const parsed = JSON.parse(body) as Record<string, unknown>;
  assert.equal(parsed.event_id, "evt-123");
  assert.equal(parsed.event_type, "qp.submission.received.v1");
  assert.deepEqual(parsed.data, { submissionRef: "sub-opaque-123", status: "pending" });
  assert.equal(body.includes("must-not-leak"), false);
  assert.equal(request.headers.get("x-tlce-timestamp"), "1794650405");

  const expected = createHmac("sha256", secret).update(`1794650405.${body}`).digest("hex");
  assert.equal(request.headers.get("x-tlce-signature"), `sha256=${expected}`);
});

test("rejects event types outside the explicit allowlist before network access", async () => {
  let calls = 0;
  const consumer = makeConsumer(async () => {
    calls += 1;
    return new Response("ok");
  });
  await assert.rejects(
    () => consumer.handle({ ...baseEvent, eventType: "qp.user.created.v1" }),
    /not approved/,
  );
  assert.equal(calls, 0);
});

test("rejects invalid required payload values", async () => {
  const consumer = makeConsumer(async () => new Response("ok"));
  await assert.rejects(
    () => consumer.handle({
      ...baseEvent,
      payload: { submissionRef: "sub-1", status: "draft", email: "x" } as never,
    }),
    /Invalid submission-received status/,
  );
});

test("rejects non-Zapier, insecure, or credential-bearing hook URLs", () => {
  const fetchImpl: typeof fetch = async () => new Response("ok");
  for (const hookUrl of [
    "http://hooks.zapier.com/hooks/catch/a/b",
    "https://example.com/hooks/catch/a/b",
    "https://user:pass@hooks.zapier.com/hooks/catch/a/b",
    "https://hooks.zapier.com/hooks/catch/a/b?token=extra",
  ]) {
    assert.throws(
      () => makeConsumer(fetchImpl, { hookUrl }),
      /Zapier Catch Hook URL|HTTPS hooks.zapier.com/,
    );
  }
});

test("surfaces non-success HTTP responses for bounded event-processor retry", async () => {
  const consumer = makeConsumer(async () => new Response("failed", { status: 503 }));
  await assert.rejects(() => consumer.handle(baseEvent), /HTTP 503/);
});

test("rejects an undersized signing secret", () => {
  assert.throws(
    () => makeConsumer(async () => new Response("ok"), { signingSecret: "short" }),
    /at least 32 characters/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { TlceEvent } from "../contracts/events.js";
import { ZapierEventConsumer } from "./zapier-event-consumer.js";

const baseEvent: TlceEvent<Record<string, unknown>> = {
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

test("supports each of the other approved event schemas", async () => {
  const captured: string[] = [];
  const consumer = makeConsumer(async (_input, init) => {
    captured.push(String(init?.body));
    return new Response("ok", { status: 200 });
  });
  const events: TlceEvent<Record<string, unknown>>[] = [
    { ...baseEvent, eventType: "qp.submission.reviewed.v1", payload: { submissionRef: "sub-2", status: "approved", reasonCode: "policy-ok", privateNote: "drop" } },
    { ...baseEvent, eventType: "qp.offer.expiring.v1", payload: { offerRef: "offer-2", expiresAt: "2026-11-15T10:00:00.000Z", internalUrl: "drop" } },
    { ...baseEvent, eventType: "tlce.module.health.degraded.v1", payload: { moduleId: "questpulse", health: "degraded", correlationId: "corr-2", stackTrace: "drop" } },
  ];
  for (const event of events) await consumer.handle(event);
  assert.equal(captured.length, 3);
  assert.equal(captured.join("\n").includes("drop"), false);
  assert.equal(captured[0].includes("policy-ok"), true);
});

test("rejects event types outside the explicit allowlist before network access", async () => {
  let calls = 0;
  const consumer = makeConsumer(async () => {
    calls += 1;
    return new Response("ok");
  });
  await assert.rejects(() => consumer.handle({ ...baseEvent, eventType: "qp.user.created.v1" }), /not approved/);
  assert.equal(calls, 0);
});

test("rejects malformed metadata, schema versions, and oversized payloads", async () => {
  const consumer = makeConsumer(async () => new Response("ok"));
  await assert.rejects(() => consumer.handle({ ...baseEvent, producerModule: " " }), /producerModule/);
  await assert.rejects(() => consumer.handle({ ...baseEvent, idempotencyKey: "" }), /idempotencyKey/);
  await assert.rejects(() => consumer.handle({ ...baseEvent, schemaVersion: 2 }), /schema version/);
  await assert.rejects(() => consumer.handle({ ...baseEvent, payload: { submissionRef: "x".repeat(9_000), status: "pending" } }), /200/);
});

test("rejects invalid required payload values", async () => {
  const consumer = makeConsumer(async () => new Response("ok"));
  await assert.rejects(
    () => consumer.handle({ ...baseEvent, payload: { submissionRef: "sub-1", status: "draft" } }),
    /Invalid submission-received status/,
  );
});

test("rejects non-standard, insecure, or credential-bearing hook URLs", () => {
  const fetchImpl: typeof fetch = async () => new Response("ok");
  for (const hookUrl of [
    "http://hooks.zapier.com/hooks/catch/a/b",
    "https://example.com/hooks/catch/a/b",
    "https://user:pass@hooks.zapier.com/hooks/catch/a/b",
    "https://hooks.zapier.com:444/hooks/catch/a/b",
    "https://hooks.zapier.com/hooks/catch/a/b?token=extra",
    "https://hooks.zapier.com/other/a/b",
  ]) {
    assert.throws(() => makeConsumer(fetchImpl, { hookUrl }), /Zapier Catch Hook URL|standard HTTPS Catch Hook URL/);
  }
});

test("surfaces non-success HTTP responses for bounded event-processor retry", async () => {
  const consumer = makeConsumer(async () => new Response("failed", { status: 503 }));
  await assert.rejects(() => consumer.handle(baseEvent), /HTTP 503/);
});

test("rejects an undersized signing secret", () => {
  assert.throws(() => makeConsumer(async () => new Response("ok"), { signingSecret: "short" }), /at least 32 characters/);
});

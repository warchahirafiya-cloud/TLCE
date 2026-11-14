import test from "node:test";
import assert from "node:assert/strict";
import { ApiGatewayRouter } from "../src/router.js";
import { createAiCoreBridgeRoute } from "../src/ai-core-bridge.js";
import type { TlceEvent } from "../../serverless-edge/contracts/events.js";

test("publishes a validated Q.P event through the protected gateway route", async () => {
  const published: TlceEvent[] = [];
  const gateway = new ApiGatewayRouter();
  gateway.register(createAiCoreBridgeRoute({
    publisher: { publish: async (event) => { published.push(event); } },
    eventIdFactory: () => "event-1",
    now: () => new Date("2026-11-14T11:00:00.000Z"),
  }));

  const response = await gateway.dispatch({
    method: "POST",
    path: "/integrations/ai-core-bridge",
    requestId: "request-1",
    principal: {
      moduleId: "zapier-bridge",
      capabilities: new Set(["integrations.ai-core-bridge.write"]),
    },
    body: { deliveryId: "delivery-1", taskId: "task-1", input: { prompt: "Summarize this" } },
  });

  assert.equal(response.status, 202);
  assert.equal(published.length, 1);
  assert.equal(published[0].eventType, "questpulse.task.requested");
  assert.equal(published[0].producerModule, "tlce-ai-core-bridge");
  assert.equal(published[0].idempotencyKey, "delivery-1");
  assert.deepEqual(published[0].payload, {
    taskId: "task-1",
    action: "process",
    input: { prompt: "Summarize this" },
  });
});

test("denies ingress without the bridge capability", async () => {
  const gateway = new ApiGatewayRouter();
  gateway.register(createAiCoreBridgeRoute({
    publisher: { publish: async () => {} },
    eventIdFactory: () => "event-1",
  }));
  const response = await gateway.dispatch({
    method: "POST",
    path: "/integrations/ai-core-bridge",
    requestId: "request-2",
    principal: { moduleId: "zapier-bridge", capabilities: new Set() },
    body: { deliveryId: "d1", taskId: "t1", input: {} },
  });
  assert.equal(response.status, 403);
});

test("rejects unknown fields and oversized or malformed input", async () => {
  const gateway = new ApiGatewayRouter();
  let publishCount = 0;
  gateway.register(createAiCoreBridgeRoute({
    publisher: { publish: async () => { publishCount += 1; } },
    eventIdFactory: () => "event-1",
    maxPayloadBytes: 256,
  }));
  const principal = {
    moduleId: "zapier-bridge",
    capabilities: new Set(["integrations.ai-core-bridge.write"]),
  };
  const dispatch = (body: unknown) => gateway.dispatch({
    method: "POST", path: "/integrations/ai-core-bridge",
    requestId: "request-3", principal, body,
  });

  assert.equal((await dispatch({ deliveryId: "d", taskId: "t", input: {}, admin: true })).status, 400);
  assert.equal((await dispatch({ deliveryId: "d", taskId: "t", input: { data: "x".repeat(512) } })).status, 400);
  assert.equal((await dispatch({ deliveryId: "d", taskId: "t", input: [] })).status, 400);
  assert.equal(publishCount, 0);
});

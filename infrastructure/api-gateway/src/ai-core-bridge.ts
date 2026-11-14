import type { GatewayRequest, GatewayRoute } from "./contracts.js";
import type { EventPublisher, TlceEvent } from "../../serverless-edge/contracts/events.js";

export interface AiCoreBridgePayload extends Record<string, unknown> {
  taskId: string;
  action: "process";
  input: Record<string, unknown>;
}

export interface AiCoreBridgeOptions {
  publisher: EventPublisher;
  eventIdFactory: () => string;
  now?: () => Date;
  maxPayloadBytes?: number;
}

/**
 * Creates the authenticated ingress route for automation providers such as Zapier.
 * Authentication is enforced by the enclosing gateway capability policy. This
 * adapter only validates and publishes a versioned event; it never calls an AI
 * provider or handles provider secrets.
 */
export function createAiCoreBridgeRoute(options: AiCoreBridgeOptions): GatewayRoute {
  const now = options.now ?? (() => new Date());
  const maxPayloadBytes = options.maxPayloadBytes ?? 16_384;

  if (!options.publisher || typeof options.publisher.publish !== "function") {
    throw new Error("AI Core Bridge requires an event publisher");
  }
  if (typeof options.eventIdFactory !== "function") {
    throw new Error("AI Core Bridge requires an event ID factory");
  }
  if (!Number.isSafeInteger(maxPayloadBytes) || maxPayloadBytes < 256 || maxPayloadBytes > 65_536) {
    throw new Error("maxPayloadBytes must be between 256 and 65536");
  }

  return {
    method: "POST",
    path: "/integrations/ai-core-bridge",
    requiredCapability: "integrations.ai-core-bridge.write",
    handler: async (request: GatewayRequest) => {
      const parsed = parsePayload(request.body, maxPayloadBytes);
      if (!parsed) return { status: 400, requestId: request.requestId };

      const event: TlceEvent<AiCoreBridgePayload> = {
        eventId: options.eventIdFactory(),
        eventType: "questpulse.task.requested",
        schemaVersion: 1,
        occurredAt: now().toISOString(),
        producerModule: "tlce-ai-core-bridge",
        idempotencyKey: parsed.deliveryId,
        payload: {
          taskId: parsed.taskId,
          action: "process",
          input: parsed.input,
        },
      };

      if (!event.eventId || typeof event.eventId !== "string" || event.eventId.length > 128) {
        throw new Error("Event ID factory returned an invalid identifier");
      }

      await options.publisher.publish(event);
      return {
        status: 202,
        requestId: request.requestId,
        body: { accepted: true, eventId: event.eventId },
      };
    },
  };
}

interface ParsedPayload {
  deliveryId: string;
  taskId: string;
  input: Record<string, unknown>;
}

function parsePayload(body: unknown, maxPayloadBytes: number): ParsedPayload | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => !["deliveryId", "taskId", "input"].includes(key)) ||
      keys.length !== 3) return null;

  if (typeof record.deliveryId !== "string" ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(record.deliveryId) ||
      typeof record.taskId !== "string" ||
      !/^[A-Za-z0-9._:-]{1,128}$/.test(record.taskId) ||
      !record.input || typeof record.input !== "object" || Array.isArray(record.input)) {
    return null;
  }

  try {
    const serialized = JSON.stringify(record.input);
    if (new TextEncoder().encode(serialized).byteLength > maxPayloadBytes) return null;
  } catch {
    return null;
  }

  return {
    deliveryId: record.deliveryId,
    taskId: record.taskId,
    input: record.input as Record<string, unknown>,
  };
}

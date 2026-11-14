import { createHmac } from "node:crypto";
import type { EventConsumer, TlceEvent } from "../contracts/events.js";

type AllowedPayload =
  | { submissionRef: string; status: "pending" | "approved" | "rejected" }
  | { submissionRef: string; status: "approved" | "rejected"; reasonCode?: string }
  | { offerRef: string; expiresAt: string }
  | { moduleId: string; health: "degraded"; correlationId: string };

type AllowedEventType =
  | "qp.submission.received.v1"
  | "qp.submission.reviewed.v1"
  | "qp.offer.expiring.v1"
  | "tlce.module.health.degraded.v1";

export interface ZapierDeliveryConfig {
  hookUrl: string;
  signingSecret: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface ZapierDeliveryResult {
  eventId: string;
  status: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw new Error(`Invalid Zapier event field: ${field}`);
  }
  return value;
}

function sanitizePayload(eventType: AllowedEventType, value: unknown): AllowedPayload {
  if (!isRecord(value)) throw new Error("Zapier event payload must be an object");

  switch (eventType) {
    case "qp.submission.received.v1": {
      const status = value.status;
      if (status !== "pending") throw new Error("Invalid submission-received status");
      return { submissionRef: requireString(value.submissionRef, "submissionRef"), status };
    }
    case "qp.submission.reviewed.v1": {
      const status = value.status;
      if (status !== "approved" && status !== "rejected") {
        throw new Error("Invalid submission-reviewed status");
      }
      const payload: { submissionRef: string; status: "approved" | "rejected"; reasonCode?: string } = {
        submissionRef: requireString(value.submissionRef, "submissionRef"),
        status,
      };
      if (value.reasonCode !== undefined) {
        payload.reasonCode = requireString(value.reasonCode, "reasonCode");
      }
      return payload;
    }
    case "qp.offer.expiring.v1": {
      const expiresAt = requireString(value.expiresAt, "expiresAt");
      if (Number.isNaN(Date.parse(expiresAt))) throw new Error("Invalid offer expiry timestamp");
      return { offerRef: requireString(value.offerRef, "offerRef"), expiresAt };
    }
    case "tlce.module.health.degraded.v1":
      if (value.health !== "degraded") throw new Error("Invalid module health state");
      return {
        moduleId: requireString(value.moduleId, "moduleId"),
        health: "degraded",
        correlationId: requireString(value.correlationId, "correlationId"),
      };
  }
}

function validateHookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid Zapier Catch Hook URL");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "hooks.zapier.com" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Zapier hook must be an HTTPS hooks.zapier.com URL without credentials, query, or fragment");
  }
  return url;
}

/**
 * Outbound-only, allowlisted Zapier adapter.
 * Configure only on a server; never expose the hook URL or signing secret to browser code.
 */
export class ZapierEventConsumer implements EventConsumer {
  private readonly hookUrl: URL;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly config: ZapierDeliveryConfig) {
    this.hookUrl = validateHookUrl(config.hookUrl);
    if (!config.signingSecret || config.signingSecret.length < 32) {
      throw new Error("Zapier signing secret must contain at least 32 characters");
    }
    this.timeoutMs = config.timeoutMs ?? 5_000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 250 || this.timeoutMs > 30_000) {
      throw new Error("timeoutMs must be an integer between 250 and 30000");
    }
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.now = config.now ?? (() => new Date());
  }

  async handle(event: TlceEvent): Promise<void> {
    if (!event || typeof event !== "object" || !event.eventId?.trim()) {
      throw new Error("Invalid TLCE event");
    }
    const allowedTypes: readonly string[] = [
      "qp.submission.received.v1",
      "qp.submission.reviewed.v1",
      "qp.offer.expiring.v1",
      "tlce.module.health.degraded.v1",
    ];
    if (!allowedTypes.includes(event.eventType)) {
      throw new Error("Event type is not approved for Zapier delivery");
    }
    if (!Number.isSafeInteger(event.schemaVersion) || event.schemaVersion !== 1) {
      throw new Error("Unsupported Zapier event schema version");
    }
    if (Number.isNaN(Date.parse(event.occurredAt))) throw new Error("Invalid event timestamp");

    const payload = sanitizePayload(event.eventType as AllowedEventType, event.payload);
    const body = JSON.stringify({
      event_id: event.eventId,
      event_type: event.eventType,
      schema_version: event.schemaVersion,
      occurred_at: event.occurredAt,
      producer_module: event.producerModule,
      idempotency_key: event.idempotencyKey,
      data: payload,
    });
    const timestamp = String(Math.floor(this.now().getTime() / 1000));
    const signature = createHmac("sha256", this.config.signingSecret)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    const response = await this.fetchImpl(this.hookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-tlce-timestamp": timestamp,
        "x-tlce-signature": `sha256=${signature}`,
        "x-tlce-event-id": event.eventId,
      },
      body,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`Zapier delivery failed with HTTP ${response.status}`);
  }
}

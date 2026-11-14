export interface Llm7ChatEnv {
  LLM7_API_KEY: string;
  LLM7_BASE_URL?: string;
  LLM7_MODEL?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 8_000;
const MAX_BODY_BYTES = 64 * 1024;
const DEFAULT_BASE_URL = "https://api.llm7.io/v1";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBoundedBody(request: Request): Promise<string | null> {
  if (!request.body) return null;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) return null;

  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (!isRecord(item) ||
        (item.role !== "user" && item.role !== "assistant") ||
        typeof item.content !== "string" ||
        item.content.trim().length === 0 ||
        item.content.length > MAX_MESSAGE_LENGTH) return null;
    messages.push({ role: item.role, content: item.content });
  }

  if (messages[0]?.role !== "user") return null;
  for (let index = 1; index < messages.length; index += 1) {
    if (messages[index]?.role === messages[index - 1]?.role) return null;
  }
  return messages;
}

/**
 * Same-origin chat proxy. Mount behind TLCE identity/rate-limit middleware;
 * never expose this handler as an anonymous public endpoint.
 */
export function createLlm7ChatHandler(
  env: Llm7ChatEnv,
  fetchImpl: typeof fetch = fetch,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).origin !== new URL(request.url).origin) {
          return json({ error: "Cross-origin requests are not allowed" }, 403);
        }
      } catch {
        return json({ error: "Invalid request origin" }, 403);
      }
    }

    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return json({ error: "Content-Type must be application/json" }, 415);
    }

    const contentLengthHeader = request.headers.get("content-length");
    if (contentLengthHeader !== null) {
      if (!/^\d+$/.test(contentLengthHeader) || Number(contentLengthHeader) > MAX_BODY_BYTES) {
        return json({ error: "Request body is too large or has an invalid length" }, 413);
      }
    }

    if (!env.LLM7_API_KEY?.trim()) {
      return json({ error: "Chat service is not configured" }, 503);
    }

    const rawBody = await readBoundedBody(request);
    if (rawBody === null) {
      return json({ error: "Request body is too large or unreadable" }, 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody) as unknown;
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!isRecord(payload)) return json({ error: "Invalid request" }, 400);
    const messages = parseMessages(payload.messages);
    if (!messages) {
      return json({ error: "Messages must contain 1–20 alternating user/assistant turns" }, 400);
    }

    const baseUrl = (env.LLM7_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
    let upstream: Response;
    try {
      upstream = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.LLM7_API_KEY}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          model: env.LLM7_MODEL || "default",
          messages,
        }),
      });
    } catch {
      return json({ error: "The AI provider could not be reached" }, 502);
    }

    if (!upstream.ok) {
      return json({ error: "The AI provider returned an error", providerStatus: upstream.status }, 502);
    }

    let result: unknown;
    try {
      result = await upstream.json();
    } catch {
      return json({ error: "The AI provider returned an invalid response" }, 502);
    }

    if (!isRecord(result) || !Array.isArray(result.choices)) {
      return json({ error: "The AI provider response had an unexpected shape" }, 502);
    }

    const firstChoice = result.choices[0];
    if (!isRecord(firstChoice) || !isRecord(firstChoice.message) ||
        typeof firstChoice.message.content !== "string") {
      return json({ error: "The AI provider returned no message" }, 502);
    }

    return json({ reply: firstChoice.message.content });
  };
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { createLlm7ChatHandler } from "./handler.js";

const env = { LLM7_API_KEY: "test-secret", LLM7_MODEL: "default" };
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://tlce.test/api/llm7/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("rejects methods other than POST", async () => {
  const handler = createLlm7ChatHandler(env);
  const response = await handler(new Request("https://tlce.test/api/llm7/chat"));
  assert.equal(response.status, 405);
});

test("rejects malformed and non-alternating message histories", async () => {
  const handler = createLlm7ChatHandler(env);
  const response = await handler(request({
    messages: [
      { role: "user", content: "Hello" },
      { role: "user", content: "Again" },
    ],
  }));
  assert.equal(response.status, 400);
});

test("forwards the model and conversation without exposing the API key", async () => {
  let forwardedUrl = "";
  let forwardedAuthorization = "";
  let forwardedBody: Record<string, unknown> = {};

  const handler = createLlm7ChatHandler(env, async (input, init) => {
    forwardedUrl = String(input);
    forwardedAuthorization = new Headers(init?.headers).get("authorization") ?? "";
    forwardedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ choices: [{ message: { content: "Hello from LLM7" } }] });
  });

  const response = await handler(request({ messages: [{ role: "user", content: "Hello" }] }));
  assert.equal(response.status, 200);
  assert.equal(forwardedUrl, "https://api.llm7.io/v1/chat/completions");
  assert.equal(forwardedAuthorization, "Bearer test-secret");
  assert.equal(forwardedBody.model, "default");
  assert.deepEqual(await response.json(), { reply: "Hello from LLM7" });
});

test("does not relay provider error details", async () => {
  const handler = createLlm7ChatHandler(env, async () =>
    new Response("private upstream diagnostics", { status: 401 }),
  );
  const response = await handler(request({ messages: [{ role: "user", content: "Hello" }] }));
  const body = await response.json() as { error: string };
  assert.equal(response.status, 502);
  assert.equal(body.error, "The AI provider returned an error");
  assert.equal(JSON.stringify(body).includes("private"), false);
});

test("rejects oversized declared request bodies", async () => {
  const handler = createLlm7ChatHandler(env);
  const response = await handler(request(
    { messages: [{ role: "user", content: "Hello" }] },
    { "content-length": String(70 * 1024) },
  ));
  assert.equal(response.status, 413);
});

test("rejects invalid content-length headers", async () => {
  const handler = createLlm7ChatHandler(env);
  const response = await handler(request(
    { messages: [{ role: "user", content: "Hello" }] },
    { "content-length": "not-a-number" },
  ));
  assert.equal(response.status, 413);
});

test("enforces the body limit while streaming, even without content-length", async () => {
  const handler = createLlm7ChatHandler(env);
  const oversized = new Uint8Array(65 * 1024);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(oversized);
      controller.close();
    },
  });
  const response = await handler(new Request("https://tlce.test/api/llm7/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    // Node's Request implementation requires this for streaming request bodies.
    duplex: "half",
  } as RequestInit));
  assert.equal(response.status, 413);
});

test("rejects cross-origin browser requests", async () => {
  const handler = createLlm7ChatHandler(env);
  const response = await handler(request(
    { messages: [{ role: "user", content: "Hello" }] },
    { origin: "https://attacker.example" },
  ));
  assert.equal(response.status, 403);
});

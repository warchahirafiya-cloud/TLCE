import assert from "node:assert/strict";
import { test } from "node:test";
import { createLlm7ChatHandler, type Llm7ChatSecurityPolicy } from "./handler.js";

const env = { LLM7_API_KEY: "test-secret", LLM7_MODEL: "default" };
const security: Llm7ChatSecurityPolicy = {
  authenticate: async () => true,
  allowRequest: async () => true,
};
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://tlce.test/api/llm7/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("fails closed when identity and rate-limit policy are not configured", async () => {
  const handler = createLlm7ChatHandler(env);
  const response = await handler(request({ messages: [{ role: "user", content: "Hello" }] }));
  assert.equal(response.status, 503);
});

test("rejects unauthenticated requests before contacting the provider", async () => {
  const handler = createLlm7ChatHandler(env, fetch, {
    authenticate: async () => false,
    allowRequest: async () => true,
  });
  const response = await handler(request({ messages: [{ role: "user", content: "Hello" }] }));
  assert.equal(response.status, 401);
});

test("rejects requests blocked by the shared rate limiter", async () => {
  const handler = createLlm7ChatHandler(env, fetch, {
    authenticate: async () => true,
    allowRequest: async () => false,
  });
  const response = await handler(request({ messages: [{ role: "user", content: "Hello" }] }));
  assert.equal(response.status, 429);
});

test("rejects methods other than POST", async () => {
  const handler = createLlm7ChatHandler(env, fetch, security);
  const response = await handler(new Request("https://tlce.test/api/llm7/chat"));
  assert.equal(response.status, 405);
});

test("rejects malformed and non-alternating message histories", async () => {
  const handler = createLlm7ChatHandler(env, fetch, security);
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
  }, security);

  const response = await handler(request({
    messages: [{ role: "user", content: "Hello" }],
  }));

  assert.equal(response.status, 200);
  assert.equal(forwardedUrl, "https://api.llm7.io/v1/chat/completions");
  assert.equal(forwardedAuthorization, "Bearer test-secret");
  assert.equal(forwardedBody.model, "default");
  assert.deepEqual(await response.json(), { reply: "Hello from LLM7" });
});

test("does not relay provider error details", async () => {
  const handler = createLlm7ChatHandler(env, async () =>
    new Response("private upstream diagnostics", { status: 401 }),
  security);
  const response = await handler(request({
    messages: [{ role: "user", content: "Hello" }],
  }));
  const body = await response.json() as { error: string };
  assert.equal(response.status, 502);
  assert.equal(body.error, "The AI provider returned an error");
  assert.equal(JSON.stringify(body).includes("private"), false);
});

test("rejects oversized declared request bodies", async () => {
  const handler = createLlm7ChatHandler(env, fetch, security);
  const response = await handler(request(
    { messages: [{ role: "user", content: "Hello" }] },
    { "content-length": String(70 * 1024) },
  ));
  assert.equal(response.status, 413);
});

test("rejects malformed content length", async () => {
  const handler = createLlm7ChatHandler(env, fetch, security);
  const response = await handler(request(
    { messages: [{ role: "user", content: "Hello" }] },
    { "content-length": "not-a-number" },
  ));
  assert.equal(response.status, 400);
});

test("rejects cross-origin browser requests", async () => {
  const handler = createLlm7ChatHandler(env, fetch, security);
  const response = await handler(request(
    { messages: [{ role: "user", content: "Hello" }] },
    { origin: "https://attacker.example" },
  ));
  assert.equal(response.status, 403);
});

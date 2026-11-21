import test from "node:test";
import assert from "node:assert/strict";
import { searchWeb, getSearchProviderStatus } from "../search-engine.js";
import { createSearchHandler } from "../handler.js";

function response(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

test("public provider fallbacks return normalized and deduplicated results", async () => {
  const fetchMock: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.duckduckgo.com") return response({
      Heading: "Example", AbstractURL: "https://example.org/", AbstractText: "Example summary",
      RelatedTopics: [{ FirstURL: "https://example.org/", Text: "Duplicate result" }],
    });
    if (url.hostname === "en.wikipedia.org") return response([ "sample", ["Example"], ["Wiki summary"], ["https://en.wikipedia.org/wiki/Example"] ]);
    throw new Error("Unexpected provider");
  };
  const result = await searchWeb("sample query", { enablePublicProviders: true }, fetchMock);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0]?.provider, "duckduckgo");
  assert.equal(result.results[1]?.provider, "wikipedia");
  assert.equal(result.partial, false);
});

test("keyed provider is not called unless a key is configured", async () => {
  let calls = 0;
  const fetchMock: typeof fetch = async () => { calls += 1; return response({}); };
  await searchWeb("test query", { enablePublicProviders: false }, fetchMock);
  assert.equal(calls, 0);
  assert.equal(getSearchProviderStatus({}).find((item) => item.id === "brave")?.enabled, false);
});

test("Brave key is sent only as a server-side request header", async () => {
  let observed = "";
  const fetchMock: typeof fetch = async (input, init) => {
    observed = new Headers(init?.headers).get("x-subscription-token") ?? "";
    assert.equal(new URL(String(input)).hostname, "api.search.brave.com");
    return response({ web: { results: [{ title: "Result", url: "https://example.com", description: "Snippet" }] } });
  };
  const result = await searchWeb("test query", { braveApiKey: "server-secret", enablePublicProviders: false }, fetchMock);
  assert.equal(observed, "server-secret");
  assert.equal(result.results[0]?.title, "Result");
  assert.equal(JSON.stringify(result).includes("server-secret"), false);
});

test("invalid and overlong queries are rejected", async () => {
  await assert.rejects(() => searchWeb("x"));
  await assert.rejects(() => searchWeb("q".repeat(241)));
});

test("search endpoint fails closed without identity and shared rate limiting", async () => {
  const handler = createSearchHandler({ enablePublicProviders: true });
  const responseValue = await handler(new Request("https://tlce.example/api/search?q=test"));
  assert.equal(responseValue.status, 503);
});

test("search endpoint enforces authentication and rate limiting before provider calls", async () => {
  let calls = 0;
  const handler = createSearchHandler({ enablePublicProviders: true }, {
    authenticate: async () => true,
    allowRequest: async () => false,
  }, async () => { calls += 1; return response({}); });
  const responseValue = await handler(new Request("https://tlce.example/api/search?q=test"));
  assert.equal(responseValue.status, 429);
  assert.equal(calls, 0);
});

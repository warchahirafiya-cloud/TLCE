import test from "node:test";
import assert from "node:assert/strict";
import { createCloudflareAccessVerifier } from "../src/cloudflare-access.js";

const TEAM = "tlce.cloudflareaccess.com";
const ISSUER = `https://${TEAM}`;
const AUD = "spaces-application-aud";
const NOW = 1_800_000_000;

type KeyPair = CryptoKeyPair;
async function makeKeyPair(kid = "access-key-1"): Promise<{ pair: KeyPair; jwk: JsonWebKey & { kid: string; alg: string; use: string } }> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  ) as KeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey) as JsonWebKey & { kid: string; alg: string; use: string };
  jwk.kid = kid;
  jwk.alg = "RS256";
  jwk.use = "sig";
  return { pair, jwk };
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function token(
  pair: KeyPair,
  overrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {},
): Promise<string> {
  const header = encode({ alg: "RS256", typ: "JWT", kid: "access-key-1", ...headerOverrides });
  const payload = encode({
    iss: ISSUER,
    aud: [AUD],
    type: "app",
    sub: "7335d417-61da-459d-899c-0a01c76a2f94",
    iat: NOW - 5,
    nbf: NOW - 5,
    exp: NOW + 300,
    ...overrides,
  });
  const input = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, input);
  return `${header}.${payload}.${Buffer.from(signature).toString("base64url")}`;
}

function verifier(jwk: JsonWebKey, fetcher?: typeof fetch) {
  return createCloudflareAccessVerifier({
    teamDomain: TEAM,
    audience: AUD,
    nowSeconds: () => NOW,
    fetcher: fetcher ?? (async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 })),
  });
}

test("verifies an Access application JWT and derives an issuer-namespaced principal ID", async () => {
  const { pair, jwk } = await makeKeyPair();
  const verified = await verifier(jwk).verify(await token(pair));
  assert.deepEqual(verified, {
    issuer: ISSUER,
    subject: "7335d417-61da-459d-899c-0a01c76a2f94",
    principalId: `cfaccess:${ISSUER}:7335d417-61da-459d-899c-0a01c76a2f94`,
  });
});

test("rejects a token for a different Access application audience", async () => {
  const { pair, jwk } = await makeKeyPair();
  assert.equal(await verifier(jwk).verify(await token(pair, { aud: ["another-aud"] })), null);
});

test("rejects a token from a different issuer", async () => {
  const { pair, jwk } = await makeKeyPair();
  assert.equal(await verifier(jwk).verify(await token(pair, { iss: "https://attacker.cloudflareaccess.com" })), null);
});

test("rejects expired, future-issued, and not-yet-valid tokens", async () => {
  const { pair, jwk } = await makeKeyPair();
  const verify = verifier(jwk);
  assert.equal(await verify.verify(await token(pair, { exp: NOW - 1 })), null);
  assert.equal(await verify.verify(await token(pair, { iat: NOW + 60 })), null);
  assert.equal(await verify.verify(await token(pair, { nbf: NOW + 60 })), null);
});

test("rejects non-application tokens and tokens without a user subject", async () => {
  const { pair, jwk } = await makeKeyPair();
  const verify = verifier(jwk);
  assert.equal(await verify.verify(await token(pair, { type: "org" })), null);
  assert.equal(await verify.verify(await token(pair, { type: "app", sub: undefined, common_name: "service-token" })), null);
});

test("rejects unsupported algorithms and malformed JWT input", async () => {
  const { pair, jwk } = await makeKeyPair();
  const verify = verifier(jwk);
  assert.equal(await verify.verify(await token(pair, {}, { alg: "HS256" })), null);
  assert.equal(await verify.verify("not-a-jwt"), null);
  assert.equal(await verify.verify("a.b.c"), null);
});

test("rejects a cryptographically invalid signature", async () => {
  const trusted = await makeKeyPair("access-key-1");
  const attacker = await makeKeyPair("access-key-1");
  assert.equal(await verifier(trusted.jwk).verify(await token(attacker.pair)), null);
});

test("refreshes JWKS once when the token kid is not in the cached keyset", async () => {
  const oldKey = await makeKeyPair("old-key");
  const rotatedKey = await makeKeyPair("access-key-1");
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ keys: calls === 1 ? [oldKey.jwk] : [rotatedKey.jwk] }), { status: 200 });
  };
  const verified = await createCloudflareAccessVerifier({
    teamDomain: TEAM, audience: AUD, nowSeconds: () => NOW, fetcher,
  }).verify(await token(rotatedKey.pair));
  assert.ok(verified);
  assert.equal(calls, 2);
});

test("fails closed when the JWKS endpoint is unavailable or invalid", async () => {
  const { pair } = await makeKeyPair();
  const unavailable = verifier({} as JsonWebKey, async () => new Response("unavailable", { status: 503 }));
  const invalid = verifier({} as JsonWebKey, async () => new Response(JSON.stringify({ keys: [] }), { status: 200 }));
  assert.equal(await unavailable.verify(await token(pair)), null);
  assert.equal(await invalid.verify(await token(pair)), null);
});

test("rejects unsafe team hostnames and missing audiences at construction", () => {
  assert.throws(() => createCloudflareAccessVerifier({ teamDomain: "https://attacker.example", audience: AUD }), /hostname/);
  assert.throws(() => createCloudflareAccessVerifier({ teamDomain: "attacker.example", audience: AUD }), /hostname/);
  assert.throws(() => createCloudflareAccessVerifier({ teamDomain: TEAM, audience: " " }), /audience/);
});

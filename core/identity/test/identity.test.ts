import test from "node:test";
import assert from "node:assert/strict";
import { authenticateBearerToken, toIdentityPrincipal } from "../src/identity";

const policy = { issuer: "https://identity.example.test", audience: "tlce-api" };
const claims = {
  sub: "user-1", iss: policy.issuer, aud: ["tlce-api"], exp: 2_000_000_000,
  nbf: 1_700_000_000, tenant_id: "tenant-a", capabilities: ["questpulse.tasks.read"],
};

test("accepts valid verified claims and creates an immutable capability set", () => {
  const principal = toIdentityPrincipal(claims, policy, 1_800_000_000);
  assert.ok(principal);
  assert.equal(principal.subject, "user-1");
  assert.equal(principal.capabilities.has("questpulse.tasks.read"), true);
});

test("rejects malformed, expired, not-yet-valid, wrong issuer and wrong audience claims", () => {
  assert.equal(toIdentityPrincipal(null, policy), null);
  assert.equal(toIdentityPrincipal({ ...claims, exp: 10 }, policy, 100), null);
  assert.equal(toIdentityPrincipal({ ...claims, nbf: 999 }, policy, 100), null);
  assert.equal(toIdentityPrincipal({ ...claims, iss: "https://attacker.test" }, policy), null);
  assert.equal(toIdentityPrincipal({ ...claims, aud: "other-api" }, policy), null);
  assert.equal(toIdentityPrincipal({ ...claims, tenant_id: "../other" }, policy), null);
  assert.equal(toIdentityPrincipal({ ...claims, capabilities: ["*"] }, policy), null);
});

test("requires bearer token and a verifier that returns verified claims", async () => {
  let calls = 0;
  const verifier = { verify: async (token: string) => { calls++; assert.equal(token, "signed-token"); return claims; } };
  assert.equal(await authenticateBearerToken(undefined, verifier, policy), null);
  assert.equal(calls, 0);
  assert.ok(await authenticateBearerToken("Bearer signed-token", verifier, policy));
  assert.equal(calls, 1);
  assert.equal(await authenticateBearerToken("Bearer bad token", verifier, policy), null);
});

test("fails closed when token verification fails", async () => {
  const verifier = { verify: async () => { throw new Error("invalid signature"); } };
  assert.equal(await authenticateBearerToken("Bearer token", verifier, policy), null);
});

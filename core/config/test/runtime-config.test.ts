import test from "node:test";
import assert from "node:assert/strict";
import { loadRuntimeConfig } from "../src/runtime-config";

test("loads safe development defaults", () => {
 const result = loadRuntimeConfig({});
 assert.deepEqual(result.errors, []);
 assert.equal(result.config?.mode, "development");
 assert.equal(result.config?.port, 3000);
});
test("rejects invalid ports and partial provider configuration", () => {
 assert.ok(loadRuntimeConfig({ PORT: "0" }).errors.some((e) => e.includes("PORT")));
 assert.ok(loadRuntimeConfig({ OIDC_ISSUER: "https://issuer.example" }).errors.some((e) => e.includes("together")));
 assert.ok(loadRuntimeConfig({ AI_PROVIDER: "provider-x" }).errors.some((e) => e.includes("together")));
});
test("requires production database, OIDC and AI configuration", () => {
 const result = loadRuntimeConfig({ TLCE_MODE: "production" });
 assert.equal(result.config, undefined);
 assert.ok(result.errors.some((e) => e.includes("DATABASE_URL")));
 assert.ok(result.errors.some((e) => e.includes("OIDC")));
 assert.ok(result.errors.some((e) => e.includes("AI_PROVIDER")));
});
test("rejects insecure OIDC issuer and non-PostgreSQL database URL", () => {
 const result = loadRuntimeConfig({ OIDC_ISSUER: "http://issuer.example", OIDC_AUDIENCE: "tlce-api", DATABASE_URL: "mysql://user:pass@db.example/app" });
 assert.ok(result.errors.some((e) => e.includes("HTTPS")));
 assert.ok(result.errors.some((e) => e.includes("PostgreSQL")));
});
test("does not include secret values in validation errors", () => {
 const secret = "super-secret-value";
 const result = loadRuntimeConfig({ TLCE_MODE: "production", AI_API_KEY: secret });
 assert.equal(JSON.stringify(result.errors).includes(secret), false);
});

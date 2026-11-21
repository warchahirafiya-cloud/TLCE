import assert from "node:assert/strict";
import test from "node:test";
import { assessPaddleReadiness } from "../src/paddle-readiness.js";
const credentials = {
  vendorId: "vendor_test", apiKey: "server-side-test-key",
  clientToken: "client-test-token", webhookSecret: "test-webhook-secret",
  domainApproved: true, payoutMethodVerified: true, approvedForLiveSales: true,
};
test("blocks live checkout until Paddle onboarding and payout are approved", () => {
  const readiness = assessPaddleReadiness({ ...credentials, approvedForLiveSales: false, payoutMethodVerified: false });
  assert.equal(readiness.readyForSandbox, true);
  assert.equal(readiness.readyForLiveCheckout, false);
  assert.ok(readiness.blockers.some((item) => item.includes("live selling")));
  assert.ok(readiness.blockers.some((item) => item.includes("Payout")));
});
test("allows live readiness only when credentials, domain, payout and provider approval exist", () => {
  const readiness = assessPaddleReadiness(credentials);
  assert.equal(readiness.readyForSandbox, true);
  assert.equal(readiness.readyForLiveCheckout, true);
  assert.deepEqual(readiness.blockers, []);
});
test("missing webhook secret prevents sandbox and live readiness", () => {
  const readiness = assessPaddleReadiness({ ...credentials, webhookSecret: "" });
  assert.equal(readiness.readyForSandbox, false);
  assert.equal(readiness.readyForLiveCheckout, false);
});

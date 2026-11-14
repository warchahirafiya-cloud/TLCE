import test from "node:test";
import assert from "node:assert/strict";
import { inspectUrl, inspectSmartContract, inspectFreeOrDiscountOffer, inspectDnsConfiguration } from "../src/analyzers.js";

test("flags dangerous URL schemes and embedded credentials", () => {
  assert.equal(inspectUrl("javascript:alert(1)").level, "critical");
  assert.equal(inspectUrl("https://user:pass@example.com").findings.some(item => item.code === "EMBEDDED_CREDENTIALS"), true);
});

test("does not certify a normal-looking URL as safe", () => {
  const result = inspectUrl("https://example.com/account");
  assert.equal(result.level, "low");
  assert.match(result.findings[0].message, /not a safety certification/);
  assert.equal(result.limitations.length > 0, true);
});

test("flags private network targets and URL shorteners", () => {
  assert.equal(inspectUrl("http://127.0.0.1/admin").level, "critical");
  assert.equal(inspectUrl("https://bit.ly/example").level, "caution");
});

test("flags unsafe contract authority and unlimited approvals", () => {
  const result = inspectSmartContract({
    chainId: 1,
    address: "0x0000000000000000000000000000000000000001",
    sourceVerified: false,
    proxy: true,
    independentAuditPublished: false,
    ownerCanPause: true,
    ownerCanMint: true,
    ownerCanUpgrade: true,
    unrestrictedApprovalsRequested: true,
  });
  assert.equal(result.level, "critical");
  assert.equal(result.findings.some(item => item.code === "UNLIMITED_APPROVAL"), true);
});

test("rejects invalid contract address formats", () => {
  const result = inspectSmartContract({
    chainId: 1, address: "not-an-address", sourceVerified: true, proxy: false,
    independentAuditPublished: true, ownerCanPause: false, ownerCanMint: false,
    ownerCanUpgrade: false, unrestrictedApprovalsRequested: false,
  });
  assert.equal(result.level, "critical");
});

test("flags free offers that request secrets or upfront payment", () => {
  const result = inspectFreeOrDiscountOffer({
    merchantDomain: "fake.example", offerUrl: "https://fake.example/free",
    officialDomainConfirmed: false, asksForUpfrontPayment: true,
    asksForSeedPhrase: true, asksForPrivateKey: false,
    asksForWalletApproval: true, rewardValueIsUnrealistic: true,
    termsAndExpiryPublished: false,
  });
  assert.equal(result.level, "critical");
  assert.equal(result.findings.some(item => item.code === "SECRET_REQUEST"), true);
});

test("compares DNS snapshots and flags DMARC/DNSSEC gaps", () => {
  const result = inspectDnsConfiguration({
    domain: "example.com",
    expected: { A: ["192.0.2.1"], MX: ["mail.example.com"] },
    observed: { A: ["192.0.2.2"], MX: ["mail.example.com"] },
    dnssecExpected: true, dnssecObserved: false,
    dmarcExpected: true, dmarcObserved: false,
  });
  assert.equal(result.level, "high");
  assert.equal(result.findings.some(item => item.code === "DNS_MISMATCH_A"), true);
  assert.equal(result.findings.some(item => item.code === "DMARC_MISSING"), true);
});

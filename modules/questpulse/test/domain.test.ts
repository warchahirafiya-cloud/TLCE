import assert from "node:assert/strict";
import { test } from "node:test";
import {
  scanUrlStructure,
  validateOpportunity,
  type QuestPulseOpportunity,
} from "../src/domain.js";

const validOpportunity: QuestPulseOpportunity = {
  id: "campaign-001",
  title: "Example campaign",
  category: "airdrop",
  summary: "Illustrative record for schema tests; not a real offer.",
  sourceUrl: "https://example.org/campaign",
  verificationStatus: "unverified",
  lastVerifiedAt: null,
  availabilityCountryCodes: ["DZ", "FR"],
  evidence: [{ kind: "official_source", url: "https://example.org", checkedAt: "2026-11-14T10:00:00Z" }],
};

test("accepts a structurally valid unverified opportunity", () => {
  assert.deepEqual(validateOpportunity(validOpportunity), { valid: true });
});

test("rejects credential-bearing or non-HTTPS source links", () => {
  const result = validateOpportunity({ ...validOpportunity, sourceUrl: "http://user:pass@example.org" });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.some((error) => error.includes("sourceUrl")));
});

test("verified records require an explicit verification timestamp", () => {
  const result = validateOpportunity({ ...validOpportunity, verificationStatus: "verified" });
  assert.equal(result.valid, false);
  if (!result.valid) assert.ok(result.errors.includes("verified opportunities require lastVerifiedAt"));
});

test("rejects malformed country codes and evidence timestamps", () => {
  const result = validateOpportunity({
    ...validOpportunity,
    availabilityCountryCodes: ["dz"],
    evidence: [{ kind: "payment_proof", url: "https://example.org/proof", checkedAt: "not-a-date" }],
  });
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((error) => error.includes("CountryCodes") || error.includes("countryCodes")));
    assert.ok(result.errors.some((error) => error.includes("checkedAt")));
  }
});

test("flags HTTP and embedded credentials without making a reputation claim", () => {
  const result = scanUrlStructure("http://user:pass@example.org/login");
  assert.ok(result.findings.some((finding) => finding.code === "non_https"));
  assert.ok(result.findings.some((finding) => finding.code === "embedded_credentials"));
  assert.equal(result.limitation, "local_structure_only_not_a_reputation_or_safety_verdict");
});

test("flags Punycode hostnames and non-default ports", () => {
  const result = scanUrlStructure("https://xn--e1afmkfd.example:8443/path");
  assert.ok(result.findings.some((finding) => finding.code === "punycode_hostname"));
  assert.ok(result.findings.some((finding) => finding.code === "unusual_port"));
});

test("invalid input produces a finding and no normalized URL", () => {
  const result = scanUrlStructure("not a URL");
  assert.equal(result.normalizedUrl, null);
  assert.equal(result.assessment, "indicators_found");
  assert.ok(result.findings.some((finding) => finding.code === "invalid_url"));
});

test("absence of structural indicators is not labelled safe", () => {
  const result = scanUrlStructure("https://example.org/");
  assert.equal(result.assessment, "no_indicators_detected");
  assert.equal(result.findings.length, 0);
  assert.equal(result.limitation, "local_structure_only_not_a_reputation_or_safety_verdict");
});

test("identifies known URL shorteners without resolving their destination", () => {
  const result = scanUrlStructure("https://bit.ly/example");
  assert.ok(result.findings.some((finding) => finding.code === "shortener_domain"));
  assert.equal(result.normalizedUrl, "https://bit.ly/example");
});

test("flags IP-literal destinations", () => {
  const result = scanUrlStructure("https://192.0.2.10/login");
  assert.ok(result.findings.some((finding) => finding.code === "ip_literal"));
});

test("flags bidirectional control characters in the supplied input", () => {
  const result = scanUrlStructure("https://example.org/\u202Elogin");
  assert.ok(result.findings.some((finding) => finding.code === "bidi_control"));
});

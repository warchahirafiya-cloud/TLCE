import test from "node:test";
import assert from "node:assert/strict";
import { validateCandidateInbox, validateOfferCatalogue } from "../src/offer-catalogue.js";

const now = Date.parse("2026-11-18T12:00:00.000Z");

function publishedOffer(overrides: Record<string, unknown> = {}) {
  return {
    id: "offer-1",
    status: "published",
    title: "Verified offer",
    description: "A source-backed offer with clear terms.",
    store: "Example Store",
    value: "10% discount",
    url: "https://offers.example/deal",
    source: "https://offers.example/about",
    verifiedAt: "2026-11-18T10:00:00.000Z",
    category: "discount",
    rewardType: "discount",
    global: false,
    countries: ["US"],
    fees: "none",
    eligibility: "US residents",
    termsUrl: "https://offers.example/terms",
    ...overrides,
  };
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    id: "candidate-1",
    title: "Candidate deal",
    description: "A candidate awaiting editorial review.",
    status: "pending_review",
    sourceId: "feed-1",
    url: "https://offers.example/deal",
    source: "https://offers.example/deal",
    countries: ["US"],
    global: false,
    discoveredAt: "2026-11-18T10:00:00.000Z",
    ...overrides,
  };
}

const sources = [{
  id: "feed-1",
  ingestionMode: "candidate-only",
  feedUrl: "https://offers.example/feed.json",
}];

test("an empty public catalogue is valid", () => {
  assert.deepEqual(validateOfferCatalogue([], now), []);
});

test("accepts a complete, recently verified published offer", () => {
  assert.deepEqual(validateOfferCatalogue([publishedOffer()], now), []);
});

test("rejects unsafe links, unsupported classifications, and missing eligibility", () => {
  const errors = validateOfferCatalogue([publishedOffer({
    url: "http://offers.example/deal",
    category: "crypto",
    global: false,
    countries: [],
    termsUrl: undefined,
  })], now);
  assert.ok(errors.some(error => error.includes("credential-free HTTPS URL")));
  assert.ok(errors.some(error => error.includes("unsupported category")));
  assert.ok(errors.some(error => error.includes("eligible countries")));
  assert.ok(errors.some(error => error.includes("termsUrl")));
});

test("rejects stale verification and expired published offers", () => {
  const errors = validateOfferCatalogue([publishedOffer({
    verifiedAt: "2026-10-01T00:00:00.000Z",
    expiresAt: "2026-11-17T00:00:00.000Z",
  })], now);
  assert.ok(errors.some(error => error.includes("older than 30 days")));
  assert.ok(errors.some(error => error.includes("expired offer")));
});

test("accepts a candidate only when source, host, country, and review status are valid", () => {
  assert.deepEqual(validateCandidateInbox([candidate()], sources), []);
});

test("rejects candidate auto-publication, global claims, and mismatched source hosts", () => {
  const errors = validateCandidateInbox([candidate({
    status: "published",
    global: true,
    url: "https://other.example/deal",
  })], sources);
  assert.ok(errors.some(error => error.includes("must not be published from the inbox")));
  assert.ok(errors.some(error => error.includes("must remain non-global")));
  assert.ok(errors.some(error => error.includes("host does not match")));
});

test("rejects unknown and non-candidate source registrations", () => {
  const errors = validateCandidateInbox([candidate()], [{
    id: "feed-1",
    ingestionMode: "automatic-publish",
    feedUrl: "https://offers.example/feed.json",
  }]);
  assert.ok(errors.some(error => error.includes("unknown or non-candidate source")));
});

test("rejects duplicate candidate IDs and duplicate canonical offer URLs", () => {
  const errors = validateCandidateInbox([
    candidate(),
    candidate({ id: "candidate-2", url: "https://offers.example/deal/" }),
  ], sources);
  assert.ok(errors.some(error => error.includes("duplicate ID")));
  assert.ok(errors.some(error => error.includes("duplicates another candidate offer URL")));
});

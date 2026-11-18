import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, filterPublicOffers, isPublicOffer } from "../questpulse-catalogue.mjs";

const now = new Date("2026-11-18T12:00:00.000Z");
const validOffer = {
  status: "published",
  title: "Welcome reward",
  url: "https://merchant.example/offer",
  termsUrl: "https://merchant.example/terms",
  category: "reward",
  countries: ["Algeria"],
  eligibility: "New customers aged 18+",
  fees: "No fee",
  verifiedAt: "2026-11-10T00:00:00.000Z",
  expiresAt: "2026-12-01T00:00:00.000Z",
  description: "A verified welcome reward"
};

test("accepts a complete, fresh, HTTPS published offer", () => {
  assert.equal(isPublicOffer(validOffer, now), true);
});

test("rejects candidates and incomplete published records", () => {
  assert.equal(isPublicOffer({ ...validOffer, status: "candidate" }, now), false);
  assert.equal(isPublicOffer({ ...validOffer, fees: "" }, now), false);
  assert.equal(isPublicOffer({ ...validOffer, countries: [] }, now), false);
});

test("rejects insecure URLs and embedded credentials", () => {
  assert.equal(isPublicOffer({ ...validOffer, url: "http://merchant.example" }, now), false);
  assert.equal(isPublicOffer({ ...validOffer, url: "https://user:pass@merchant.example" }, now), false);
});

test("rejects stale verification and expired offers", () => {
  assert.equal(isPublicOffer({ ...validOffer, verifiedAt: "2026-10-01T00:00:00.000Z" }, now), false);
  assert.equal(isPublicOffer({ ...validOffer, expiresAt: "2026-11-17T00:00:00.000Z" }, now), false);
});

test("filters by country and category without admitting candidates", () => {
  const rows = [validOffer, { ...validOffer, status: "candidate", title: "Hidden candidate" }];
  assert.deepEqual(filterPublicOffers(rows, { country: "alger", category: "reward" }, now), [validOffer]);
  assert.deepEqual(filterPublicOffers(rows, { country: "canada" }, now), []);
});

test("escapes untrusted text before HTML rendering", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

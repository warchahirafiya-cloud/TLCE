import test from "node:test";
import assert from "node:assert/strict";

class FakeElement {
  value = "";
  textContent = "";
  innerHTML = "";
  dataset = {};
  attributes = new Map();
  listeners = new Map();

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  dispatch(type, event = {}) {
    const callback = this.listeners.get(type);
    assert.ok(callback, `Expected a ${type} listener`);
    callback({
      preventDefault() {},
      currentTarget: this,
      target: this,
      ...event,
    });
  }
}

const selectors = [
  "#offer-list", "#result-count", "#catalogue-status", "#offer-filters",
  "#guide-list", "#saved-count", "#search", "#country", "#category",
  "#guide-search", "#show-saved",
];
const elements = new Map(selectors.map((selector) => [selector, new FakeElement()]));
const storage = new Map();
const now = new Date();
const offers = [{
  status: "published",
  title: "Welcome reward",
  url: "https://merchant.example/offer",
  termsUrl: "https://merchant.example/terms",
  category: "reward",
  countries: ["Algeria"],
  eligibility: "New customers aged 18+",
  fees: "No fee",
  verifiedAt: new Date(now.getTime() - 60_000).toISOString(),
  expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
  description: "A verified welcome reward",
}];
const guides = [{
  id: "guide-1",
  title: "Verify the source",
  summary: "Check the official source before participating.",
  icon: "🔎",
  level: "Basic",
  readTime: "4 minutes",
  points: ["Check the domain", "Review eligibility", "Read the fees"],
  tags: ["verification", "safety"],
}];

globalThis.document = {
  querySelector(selector) {
    const element = elements.get(selector);
    assert.ok(element, `Unexpected selector: ${selector}`);
    return element;
  },
};
globalThis.localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, String(value)); },
};
globalThis.fetch = async (input) => {
  const path = String(input);
  const data = path.includes("offers.json") ? offers : guides;
  return { ok: true, json: async () => data };
};

await import("../questpulse.js");
await new Promise((resolve) => setImmediate(resolve));

test("loads and renders verified offers and educational guides", () => {
  assert.match(elements.get("#catalogue-status").textContent, /جاهز/);
  assert.equal(elements.get("#result-count").textContent, "فرصة واحدة منشورة");
  assert.match(elements.get("#offer-list").innerHTML, /Welcome reward/);
  assert.match(elements.get("#guide-list").innerHTML, /Verify the source/);
  assert.equal(elements.get("#offer-list").getAttribute("aria-busy"), "false");
});

test("applies search and country filters to the public catalogue", () => {
  elements.get("#search").value = "Welcome";
  elements.get("#offer-filters").dispatch("submit");
  assert.match(elements.get("#offer-list").innerHTML, /Welcome reward/);

  elements.get("#country").value = "Canada";
  elements.get("#offer-filters").dispatch("submit");
  assert.match(elements.get("#result-count").textContent, /^0/);
  assert.doesNotMatch(elements.get("#offer-list").innerHTML, /Welcome reward/);
});

test("saves a guide, persists it, and filters the saved-only view", () => {
  const guideList = elements.get("#guide-list");
  guideList.dispatch("click", {
    target: {
      closest(selector) {
        assert.equal(selector, "[data-guide-id]");
        return { dataset: { guideId: "guide-1" } };
      },
    },
  });

  assert.equal(storage.get("tlce.questpulse.saved-guides.v1"), '["guide-1"]');
  assert.match(elements.get("#saved-count").textContent, /1/);

  const savedToggle = elements.get("#show-saved");
  savedToggle.dispatch("click");
  assert.equal(savedToggle.getAttribute("aria-pressed"), "true");
  assert.match(guideList.innerHTML, /Verify the source/);

  guideList.dispatch("click", {
    target: {
      closest() { return { dataset: { guideId: "guide-1" } }; },
    },
  });
  assert.match(guideList.innerHTML, /لا توجد أدلة مطابقة/);
  assert.equal(storage.get("tlce.questpulse.saved-guides.v1"), "[]");
});

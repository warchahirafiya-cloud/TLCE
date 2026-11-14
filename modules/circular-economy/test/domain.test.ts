import test from "node:test";
import assert from "node:assert/strict";
import { appraiseDigitalAsset, createRehabilitationPlan, type DigitalAssetListing } from "../src/domain.js";

const asset: DigitalAssetListing = {
  id: "asset-test-1",
  title: "Dormant commerce website",
  kind: "website",
  condition: "dormant",
  description: "A test listing for an inactive website.",
  ownerId: "owner-test",
  ownershipEvidence: "pending",
  licenseStatus: "review-required",
  securityStatus: "unknown",
  createdAt: "2026-11-14T00:00:00.000Z",
};

test("appraisal is bounded, explainable and flags legal/security blockers", () => {
  const result = appraiseDigitalAsset({
    asset,
    demandScore: 90,
    technicalQualityScore: 70,
    reusePotentialScore: 85,
    evidenceCompletenessScore: 30,
  });
  assert.equal(result.score >= 0 && result.score <= 100, true);
  assert.equal(result.confidence, "low");
  assert.equal(result.blockers.length, 3);
  assert.match(result.disclaimer, /not a monetary valuation/);
});

test("appraisal rejects non-finite factor values", () => {
  assert.throws(() => appraiseDigitalAsset({
    asset,
    demandScore: Number.NaN,
    technicalQualityScore: 50,
    reusePotentialScore: 50,
    evidenceCompletenessScore: 50,
  }), /finite numbers/);
});

test("rehabilitation plan never treats unresolved rights or security as release-ready", () => {
  const plan = createRehabilitationPlan(asset);
  assert.equal(plan.recommendedPath, "maintain-and-relaunch");
  assert.match(plan.releaseGate, /Blocked pending/);
});

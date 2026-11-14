/**
 * Domain contracts and transparent appraisal heuristics for the TLCE circular
 * digital economy. Scores are decision support, not financial valuations.
 */

export type DigitalAssetKind =
  | "domain"
  | "source-code"
  | "website"
  | "application"
  | "api"
  | "template"
  | "digital-product";

export type AssetCondition = "active" | "dormant" | "abandoned" | "incomplete";

export interface DigitalAssetListing {
  id: string;
  title: string;
  kind: DigitalAssetKind;
  condition: AssetCondition;
  description: string;
  ownerId: string;
  ownershipEvidence: "verified" | "pending" | "unverified";
  licenseStatus: "clear" | "review-required" | "unknown";
  securityStatus: "reviewed" | "review-required" | "unknown";
  documentedRevenueMonthly?: number;
  estimatedMonthlyMaintenanceCost?: number;
  createdAt: string;
}

export interface AppraisalInput {
  asset: DigitalAssetListing;
  demandScore: number;
  technicalQualityScore: number;
  reusePotentialScore: number;
  evidenceCompletenessScore: number;
}

export interface AppraisalResult {
  score: number;
  band: "low" | "moderate" | "promising" | "high-potential";
  confidence: "low" | "medium" | "high";
  blockers: string[];
  factors: {
    demand: number;
    technicalQuality: number;
    reusePotential: number;
    evidenceCompleteness: number;
    condition: number;
  };
  disclaimer: string;
}

const clampScore = (value: number): number => {
  if (!Number.isFinite(value)) throw new Error("Appraisal scores must be finite numbers");
  return Math.max(0, Math.min(100, value));
};

export function appraiseDigitalAsset(input: AppraisalInput): AppraisalResult {
  const { asset } = input;
  const factors = {
    demand: clampScore(input.demandScore),
    technicalQuality: clampScore(input.technicalQualityScore),
    reusePotential: clampScore(input.reusePotentialScore),
    evidenceCompleteness: clampScore(input.evidenceCompletenessScore),
    condition: asset.condition === "active" ? 100
      : asset.condition === "dormant" ? 75
      : asset.condition === "incomplete" ? 45 : 30,
  };

  const score = Math.round(
    factors.demand * 0.25 +
    factors.technicalQuality * 0.20 +
    factors.reusePotential * 0.25 +
    factors.evidenceCompleteness * 0.20 +
    factors.condition * 0.10,
  );

  const blockers: string[] = [];
  if (asset.ownershipEvidence !== "verified") blockers.push("Ownership evidence must be verified before transfer or licensing.");
  if (asset.licenseStatus !== "clear") blockers.push("Review intellectual-property and third-party license obligations.");
  if (asset.securityStatus !== "reviewed") blockers.push("Complete a security review before deployment or integration.");

  const confidence = factors.evidenceCompleteness >= 80 ? "high"
    : factors.evidenceCompleteness >= 50 ? "medium" : "low";

  return {
    score,
    band: score >= 80 ? "high-potential" : score >= 60 ? "promising" : score >= 40 ? "moderate" : "low",
    confidence,
    blockers,
    factors,
    disclaimer: "Indicative decision-support score only; not a monetary valuation, investment recommendation, or proof of ownership.",
  };
}

export type ReusePath =
  | "resell"
  | "license"
  | "maintain-and-relaunch"
  | "refactor-and-integrate"
  | "archive";

export interface RehabilitationPlan {
  assetId: string;
  recommendedPath: ReusePath;
  steps: string[];
  releaseGate: string;
}

export function createRehabilitationPlan(asset: DigitalAssetListing): RehabilitationPlan {
  const blockers: string[] = [];
  if (asset.ownershipEvidence !== "verified") blockers.push("verify ownership and authority to transfer");
  if (asset.licenseStatus !== "clear") blockers.push("resolve software, content and third-party licenses");
  if (asset.securityStatus !== "reviewed") blockers.push("perform dependency, secrets and vulnerability review");

  const recommendedPath: ReusePath = asset.condition === "active"
    ? "license"
    : asset.condition === "abandoned" || asset.condition === "incomplete"
      ? "refactor-and-integrate"
      : "maintain-and-relaunch";

  return {
    assetId: asset.id,
    recommendedPath,
    steps: [
      "Inventory source files, dependencies, infrastructure and data flows",
      "Verify ownership, transfer authority, trademarks and license compatibility",
      "Create an isolated backup and reproducible build",
      "Assess security, privacy, accessibility and operational costs",
      "Estimate remediation effort and define measurable acceptance criteria",
      "Update the product and test it in a non-production environment",
      "Approve relaunch, licensing or integration through the parent TLCE governance process",
    ],
    releaseGate: blockers.length
      ? `Blocked pending: ${blockers.join("; ")}.`
      : "Eligible for technical review; production release still requires parent approval.",
  };
}

export interface PartnerProfile {
  id: string;
  kind: "individual" | "company" | "retailer" | "mall" | "recycling-center" | "developer";
  capabilities: Array<"list" | "buy" | "license" | "repair" | "audit" | "integrate" | "resell">;
  verified: boolean;
}

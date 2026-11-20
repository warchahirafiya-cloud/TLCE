export type QuestPulseOfferCategory =
  | "reward"
  | "store"
  | "discount"
  | "contest"
  | "loyalty"
  | "task"
  | "referral";

export type QuestPulseRewardType =
  | "cash"
  | "gift"
  | "discount"
  | "points"
  | "prize"
  | "other";

export type QuestPulseReviewStatus =
  | "pending_review"
  | "rejected"
  | "expired"
  | "published"
  | "paused";

export interface QuestPulseOffer {
  id: string;
  status: QuestPulseReviewStatus;
  title: string;
  description: string;
  store: string;
  value: string;
  url: string;
  source: string;
  verifiedAt: string;
  category: QuestPulseOfferCategory;
  rewardType: QuestPulseRewardType;
  global: boolean;
  countries: string[];
  expiresAt?: string;
  fees: string;
  eligibility: string;
  termsUrl: string;
}

export interface QuestPulseSource {
  id: string;
  ingestionMode: "candidate-only" | "editorial" | "manual" | string;
  feedUrl?: string;
}

export interface QuestPulseCandidate {
  id: string;
  title: string;
  description: string;
  status: "pending_review" | "rejected" | "expired";
  sourceId: string;
  url: string;
  source: string;
  countries: string[];
  global: false;
  discoveredAt: string;
}

type JsonRecord = Record<string, unknown>;

const OFFER_CATEGORIES = new Set<QuestPulseOfferCategory>([
  "reward", "store", "discount", "contest", "loyalty", "task", "referral",
]);
const REWARD_TYPES = new Set<QuestPulseRewardType>([
  "cash", "gift", "discount", "points", "prize", "other",
]);
const CANDIDATE_STATUSES = new Set(["pending_review", "rejected", "expired"]);
const MAX_VERIFICATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function httpsUrl(value: unknown, label: string, errors: string[]): URL | null {
  const raw = text(value);
  if (!raw) {
    errors.push(label + " must be a non-empty HTTPS URL.");
    return null;
  }
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      errors.push(label + " must be a credential-free HTTPS URL.");
      return null;
    }
    return parsed;
  } catch {
    errors.push(label + " is not a valid URL.");
    return null;
  }
}

function validCountries(value: unknown): value is string[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every(country => typeof country === "string" && country.trim().length > 0);
}

function canonicalUrl(url: URL): string {
  const path = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  return url.origin + path + url.hash;
}

/**
 * Validates the public catalogue using the active QuestPulse publishing rules.
 * Non-published records are retained for editorial history but are not exposed
 * as public offers by this validator.
 */
export function validateOfferCatalogue(
  input: unknown,
  now = Date.now(),
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(input)) return ["Offer catalogue must be a JSON array."];

  const ids = new Set<string>();
  for (const [index, offer] of input.entries()) {
    const label = `offers[${index}]`;
    if (!isRecord(offer)) {
      errors.push(label + " must be an object.");
      continue;
    }

    const id = text(offer.id);
    if (!id) errors.push(label + ": missing id.");
    else if (ids.has(id)) errors.push(label + ": duplicate id " + id + ".");
    else ids.add(id);

    if (offer.status !== "published") continue;

    for (const key of ["title", "description", "store", "value", "url", "source", "verifiedAt", "category", "rewardType"]) {
      if (!text(offer[key])) errors.push(label + ": published offer is missing " + key + ".");
    }

    if (!OFFER_CATEGORIES.has(offer.category as QuestPulseOfferCategory)) {
      errors.push(label + ": unsupported category.");
    }
    if (!REWARD_TYPES.has(offer.rewardType as QuestPulseRewardType)) {
      errors.push(label + ": unsupported rewardType.");
    }
    if (typeof offer.global !== "boolean") {
      errors.push(label + ": global must be true or false.");
    }
    if (offer.global === false && !validCountries(offer.countries)) {
      errors.push(label + ": list eligible countries or mark the offer global.");
    }

    httpsUrl(offer.url, label + ".url", errors);
    httpsUrl(offer.source, label + ".source", errors);

    const verifiedAt = Date.parse(text(offer.verifiedAt));
    if (!Number.isFinite(verifiedAt)) {
      errors.push(label + ": verifiedAt must be a valid date.");
    } else if (verifiedAt > now + 5 * 60 * 1000) {
      errors.push(label + ": verifiedAt cannot be in the future.");
    } else if (now - verifiedAt > MAX_VERIFICATION_AGE_MS) {
      errors.push(label + ": verification is older than 30 days; review before publishing.");
    }

    if (offer.expiresAt !== undefined && text(offer.expiresAt)) {
      const expiresAt = Date.parse(text(offer.expiresAt));
      if (!Number.isFinite(expiresAt)) errors.push(label + ": expiresAt must be a valid date.");
      else if (expiresAt <= now) errors.push(label + ": expired offer cannot remain published.");
    }

    for (const key of ["fees", "eligibility", "termsUrl"]) {
      if (!text(offer[key])) {
        errors.push(label + ": disclose fees, eligibility, and termsUrl (use explicit \"none\" where applicable).");
      }
    }
    if (text(offer.termsUrl)) httpsUrl(offer.termsUrl, label + ".termsUrl", errors);
  }
  return errors;
}

/**
 * Validates discovery candidates separately from the public catalogue.
 * Candidate records can never be promoted to published by ingestion.
 */
export function validateCandidateInbox(
  inboxInput: unknown,
  sourcesInput: unknown,
): string[] {
  const errors: string[] = [];
  if (!Array.isArray(inboxInput)) return ["Candidate inbox must be a JSON array."];
  if (!Array.isArray(sourcesInput)) return ["Source registry must be a JSON array."];

  const sourceById = new Map<string, JsonRecord>();
  for (const source of sourcesInput) {
    if (isRecord(source) && text(source.id)) sourceById.set(text(source.id), source);
  }

  const ids = new Set<string>();
  const offerUrls = new Set<string>();

  for (const [index, item] of inboxInput.entries()) {
    const label = `inbox[${index}]`;
    if (!isRecord(item)) {
      errors.push(label + " must be an object.");
      continue;
    }

    const id = text(item.id);
    if (!id) errors.push(label + " is missing its ID.");
    else if (ids.has(id)) errors.push(label + " has duplicate ID " + id + ".");
    else ids.add(id);

    if (!text(item.title)) errors.push(label + " is missing its title.");
    if (!text(item.description)) errors.push(label + " is missing its description.");

    if (!CANDIDATE_STATUSES.has(text(item.status))) {
      errors.push(label + " has an invalid review status; candidates must not be published from the inbox.");
    }

    const source = sourceById.get(text(item.sourceId));
    if (!source || source.ingestionMode !== "candidate-only") {
      errors.push(label + " references an unknown or non-candidate source.");
    }

    const offerUrl = httpsUrl(item.url, label + ".url", errors);
    const sourceUrl = httpsUrl(item.source, label + ".source", errors);
    const feedUrl = source?.feedUrl
      ? httpsUrl(source.feedUrl, "Source " + text(source.id) + ".feedUrl", errors)
      : null;

    if (offerUrl) {
      const canonical = canonicalUrl(offerUrl);
      if (offerUrls.has(canonical)) errors.push(label + " duplicates another candidate offer URL.");
      else offerUrls.add(canonical);
    }
    if (source && !text(source.feedUrl)) {
      errors.push(label + " references a source without an approved feed URL.");
    }
    if (feedUrl && offerUrl && offerUrl.hostname !== feedUrl.hostname) {
      errors.push(label + " offer URL host does not match its approved feed host.");
    }
    if (feedUrl && sourceUrl && sourceUrl.hostname !== feedUrl.hostname) {
      errors.push(label + " source attribution host does not match its approved feed host.");
    }

    if (!validCountries(item.countries)) {
      errors.push(label + " must state at least one eligible country.");
    }
    if (item.global !== false) {
      errors.push(label + " must remain non-global until eligibility is independently verified.");
    }
    if (!text(item.discoveredAt) || !Number.isFinite(Date.parse(text(item.discoveredAt)))) {
      errors.push(label + " has an invalid discovery timestamp.");
    }
  }
  return errors;
}

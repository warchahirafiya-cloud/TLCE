/**
 * QuestPulse domain contracts.
 *
 * The Web3 opportunity directory is the primary discovery surface.
 * URL structure analysis is a separate, local-only safety capability that
 * can be used before opening opportunity links. Neither capability fetches
 * remote URLs or asserts that an opportunity/payout is legitimate.
 */

export const opportunityCategories = [
  "airdrop",
  "telegram_bot",
  "referral",
  "reward_app",
] as const;

export type OpportunityCategory = (typeof opportunityCategories)[number];
export type VerificationStatus = "unverified" | "under_review" | "verified" | "expired";

export interface OpportunityEvidence {
  kind: "official_source" | "terms" | "payment_proof";
  url: string;
  checkedAt: string;
}

export interface QuestPulseOpportunity {
  id: string;
  title: string;
  category: OpportunityCategory;
  summary: string;
  sourceUrl: string;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  availabilityCountryCodes: readonly string[];
  evidence: readonly OpportunityEvidence[];
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: readonly string[] };

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isIsoTimestamp(value: string): boolean {
  return value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

/**
 * Structural validation only. It does not verify that a source is genuine,
 * reachable, safe, or controlled by the named project.
 */
export function validateOpportunity(input: QuestPulseOpportunity): ValidationResult {
  const errors: string[] = [];
  if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(input.id)) errors.push("id must be a 3-64 character lowercase slug");
  if (!input.title.trim()) errors.push("title is required");
  if (!opportunityCategories.includes(input.category)) errors.push("category is unsupported");
  if (!input.summary.trim()) errors.push("summary is required");
  if (!isHttpsUrl(input.sourceUrl)) errors.push("sourceUrl must be HTTPS without embedded credentials");
  if (!["unverified", "under_review", "verified", "expired"].includes(input.verificationStatus)) {
    errors.push("verificationStatus is unsupported");
  }
  if (input.lastVerifiedAt !== null && !isIsoTimestamp(input.lastVerifiedAt)) {
    errors.push("lastVerifiedAt must be a valid timestamp or null");
  }
  if (input.verificationStatus === "verified" && input.lastVerifiedAt === null) {
    errors.push("verified opportunities require lastVerifiedAt");
  }
  if (input.availabilityCountryCodes.some((code) => !/^[A-Z]{2}$/.test(code))) {
    errors.push("availabilityCountryCodes must contain uppercase ISO-style two-letter codes");
  }
  for (const item of input.evidence) {
    if (!isHttpsUrl(item.url)) errors.push("evidence URLs must be HTTPS without embedded credentials");
    if (!isIsoTimestamp(item.checkedAt)) errors.push("evidence checkedAt must be a valid timestamp");
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export interface UrlFinding {
  code:
    | "invalid_url"
    | "non_https"
    | "embedded_credentials"
    | "punycode_hostname"
    | "ip_literal"
    | "unusual_port"
    | "shortener_domain"
    | "bidi_control";
  severity: "info" | "warning" | "high";
  message: string;
}

export interface UrlStructureScan {
  normalizedUrl: string | null;
  findings: readonly UrlFinding[];
  assessment: "indicators_found" | "no_indicators_detected";
  limitation: "local_structure_only_not_a_reputation_or_safety_verdict";
}

const bidiControls = /[\u202A-\u202E\u2066-\u2069]/u;
const ipv4Literal = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const commonShorteners = new Set(["bit.ly", "t.co", "tinyurl.com", "is.gd", "cutt.ly"]);

function isIpLiteral(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "");
  return ipv4Literal.test(host) || host.includes(":");
}

/**
 * Parses only the supplied string. Never fetches, resolves DNS, follows
 * redirects, or submits the URL to a third-party service.
 */
export function scanUrlStructure(raw: string): UrlStructureScan {
  const findings: UrlFinding[] = [];
  const add = (code: UrlFinding["code"], severity: UrlFinding["severity"], message: string) =>
    findings.push({ code, severity, message });

  if (bidiControls.test(raw)) add("bidi_control", "high", "The input contains bidirectional control characters.");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    add("invalid_url", "high", "The input is not a valid absolute URL.");
    return {
      normalizedUrl: null,
      findings,
      assessment: "indicators_found",
      limitation: "local_structure_only_not_a_reputation_or_safety_verdict",
    };
  }

  if (parsed.protocol !== "https:") {
    add("non_https", "warning", "The URL does not use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    add("embedded_credentials", "high", "The URL contains embedded username or password fields.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname.startsWith("xn--") || hostname.split(".").some((part) => part.startsWith("xn--"))) {
    add("punycode_hostname", "warning", "The hostname contains an internationalized Punycode label.");
  }
  if (isIpLiteral(hostname)) {
    add("ip_literal", "warning", "The destination uses an IP address instead of a conventional hostname.");
  }
  if (parsed.port && !["80", "443"].includes(parsed.port)) {
    add("unusual_port", "warning", "The URL uses a non-default port.");
  }
  if (commonShorteners.has(hostname)) {
    add("shortener_domain", "info", "The hostname is a URL-shortening service; the final destination is not checked.");
  }

  return {
    normalizedUrl: parsed.href,
    findings,
    assessment: findings.length > 0 ? "indicators_found" : "no_indicators_detected",
    limitation: "local_structure_only_not_a_reputation_or_safety_verdict",
  };
}

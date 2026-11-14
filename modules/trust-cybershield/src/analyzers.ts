/**
 * Deterministic, offline-first risk heuristics. These functions do not fetch URLs,
 * resolve DNS, connect wallets, simulate transactions or execute contract code.
 * A "low risk" result is not a guarantee of safety.
 */

export type RiskLevel = "low" | "caution" | "high" | "critical" | "unknown";
export interface RiskFinding {
  code: string;
  level: RiskLevel;
  message: string;
}
export interface RiskReport {
  level: RiskLevel;
  score: number;
  findings: RiskFinding[];
  limitations: string[];
}

function report(findings: RiskFinding[], limitations: string[]): RiskReport {
  const rank: Record<RiskLevel, number> = { low: 0, caution: 1, high: 2, critical: 3, unknown: 0 };
  const level = findings.reduce<RiskLevel>((worst, finding) =>
    rank[finding.level] > rank[worst] ? finding.level : worst, "low");
  const score = Math.min(100, findings.reduce((sum, finding) =>
    sum + (finding.level === "critical" ? 45 : finding.level === "high" ? 25 : finding.level === "caution" ? 10 : 0), 0));
  return { level, score, findings, limitations };
}

const privateIPv4 = (host: string): boolean => {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
};

const shortenerHosts = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy",
]);

export function inspectUrl(input: string): RiskReport {
  const findings: RiskFinding[] = [];
  const limitations = [
    "Offline syntax and heuristic inspection only; no reputation feeds, redirect chain, page content or live DNS lookup was checked.",
    "No scanner can guarantee that a link is safe. Confirm the destination independently before entering credentials or signing.",
  ];
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return report([{ code: "INVALID_URL", level: "high", message: "The supplied value is not a valid absolute URL." }], limitations);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    findings.push({ code: "UNSAFE_SCHEME", level: "critical", message: "Only HTTP(S) web links are accepted; this scheme can invoke a non-web handler." });
  }
  if (parsed.username || parsed.password) {
    findings.push({ code: "EMBEDDED_CREDENTIALS", level: "high", message: "The URL contains embedded username or password data." });
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:") || privateIPv4(host)) {
    findings.push({ code: "LOCAL_OR_PRIVATE_HOST", level: "critical", message: "The destination appears to target a local or private network host." });
  }
  if (shortenerHosts.has(host)) {
    findings.push({ code: "SHORTENER", level: "caution", message: "The shortened link hides its final destination until redirects are inspected." });
  }
  if (host.startsWith("xn--") || host.split(".").some(label => label.startsWith("xn--"))) {
    findings.push({ code: "PUNYCODE_HOST", level: "caution", message: "The domain contains an internationalized/punycode label; check for visual impersonation." });
  }
  if (host.split(".").some(label => label.length > 45) || input.length > 2048) {
    findings.push({ code: "UNUSUAL_LENGTH", level: "caution", message: "The URL or a hostname label is unusually long." });
  }
  if (parsed.protocol === "http:") {
    findings.push({ code: "NO_HTTPS", level: "caution", message: "The link does not use HTTPS; information may be exposed in transit." });
  }
  if (!findings.length) findings.push({ code: "NO_STATIC_RED_FLAGS", level: "low", message: "No obvious static red flags were found; this is not a safety certification." });
  return report(findings, limitations);
}

export interface SmartContractEvidence {
  chainId: number;
  address: string;
  sourceVerified: boolean;
  proxy: boolean;
  independentAuditPublished: boolean;
  ownerCanPause: boolean;
  ownerCanMint: boolean;
  ownerCanUpgrade: boolean;
  unrestrictedApprovalsRequested: boolean;
}

export function inspectSmartContract(input: SmartContractEvidence): RiskReport {
  const findings: RiskFinding[] = [];
  if (!Number.isSafeInteger(input.chainId) || input.chainId <= 0) {
    findings.push({ code: "INVALID_CHAIN", level: "critical", message: "A valid positive chain ID is required." });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(input.address)) {
    findings.push({ code: "INVALID_ADDRESS", level: "critical", message: "Contract address format is invalid." });
  }
  if (!input.sourceVerified) findings.push({ code: "UNVERIFIED_SOURCE", level: "high", message: "Published source code is not verified against deployed bytecode." });
  if (input.proxy && !input.ownerCanUpgrade) {
    findings.push({ code: "PROXY_REVIEW", level: "caution", message: "Proxy architecture requires separate implementation and admin-slot review." });
  }
  if (input.ownerCanUpgrade) findings.push({ code: "UPGRADE_AUTHORITY", level: "high", message: "An owner can change contract logic after deployment." });
  if (input.ownerCanMint) findings.push({ code: "MINT_AUTHORITY", level: "high", message: "An owner can mint additional tokens; supply controls require review." });
  if (input.ownerCanPause) findings.push({ code: "PAUSE_AUTHORITY", level: "caution", message: "An owner can pause contract operations." });
  if (input.unrestrictedApprovalsRequested) findings.push({ code: "UNLIMITED_APPROVAL", level: "critical", message: "The requested wallet approval is unrestricted; do not sign without understanding the spender and allowance." });
  if (!input.independentAuditPublished) findings.push({ code: "NO_INDEPENDENT_AUDIT", level: "caution", message: "No independent audit evidence was supplied; an audit badge alone would not prove safety." });
  if (!findings.length) findings.push({ code: "NO_SUBMITTED_RED_FLAGS", level: "low", message: "No risk flags were found in the submitted evidence; bytecode and live behavior were not independently analyzed." });
  return report(findings, [
    "This checks submitted metadata only. It does not retrieve chain state, verify source/bytecode, inspect storage, simulate transactions or prove the contract is safe.",
    "Never share seed phrases or private keys. Wallet signing remains a user-controlled action.",
  ]);
}

export interface OfferEvidence {
  merchantDomain: string;
  offerUrl: string;
  officialDomainConfirmed: boolean;
  asksForUpfrontPayment: boolean;
  asksForSeedPhrase: boolean;
  asksForPrivateKey: boolean;
  asksForWalletApproval: boolean;
  rewardValueIsUnrealistic: boolean;
  termsAndExpiryPublished: boolean;
}

export function inspectFreeOrDiscountOffer(input: OfferEvidence): RiskReport {
  const findings: RiskFinding[] = [];
  if (!input.officialDomainConfirmed) findings.push({ code: "MERCHANT_UNCONFIRMED", level: "high", message: "The merchant or campaign has not been confirmed through its official channel." });
  if (input.asksForSeedPhrase || input.asksForPrivateKey) findings.push({ code: "SECRET_REQUEST", level: "critical", message: "A legitimate coupon or reward must never require a seed phrase or private key." });
  if (input.asksForWalletApproval) findings.push({ code: "WALLET_APPROVAL", level: "high", message: "The offer requests a wallet approval; inspect the exact spender and permissions independently." });
  if (input.asksForUpfrontPayment) findings.push({ code: "UPFRONT_FEE", level: "high", message: "An upfront fee is requested to unlock a supposedly free reward." });
  if (input.rewardValueIsUnrealistic) findings.push({ code: "UNREALISTIC_REWARD", level: "caution", message: "The promised reward appears unusually high relative to the claimed task." });
  if (!input.termsAndExpiryPublished) findings.push({ code: "MISSING_TERMS", level: "caution", message: "Terms, eligibility and expiry details were not supplied." });
  if (!findings.length) findings.push({ code: "NO_SUBMITTED_RED_FLAGS", level: "low", message: "No obvious flags in the submitted offer details; reward availability and merchant authenticity are not independently verified." });
  return report(findings, [
    "No live merchant verification or coupon redemption was performed.",
    "A discount or free offer can still collect personal data; review permissions and privacy terms.",
  ]);
}

export interface DnsSnapshot {
  domain: string;
  expected: Record<string, string[]>;
  observed: Record<string, string[]>;
  dnssecExpected: boolean;
  dnssecObserved: boolean;
  dmarcExpected: boolean;
  dmarcObserved: boolean;
}

export function inspectDnsConfiguration(input: DnsSnapshot): RiskReport {
  const findings: RiskFinding[] = [];
  const types = new Set([...Object.keys(input.expected), ...Object.keys(input.observed)]);
  for (const type of types) {
    const expected = [...(input.expected[type] ?? [])].sort();
    const observed = [...(input.observed[type] ?? [])].sort();
    if (expected.join("|") !== observed.join("|")) {
      findings.push({ code: `DNS_MISMATCH_${type.toUpperCase()}`, level: "high", message: `Observed ${type} records differ from the expected configuration.` });
    }
  }
  if (input.dnssecExpected && !input.dnssecObserved) findings.push({ code: "DNSSEC_MISSING", level: "caution", message: "DNSSEC was expected but was not reported in the supplied snapshot." });
  if (input.dmarcExpected && !input.dmarcObserved) findings.push({ code: "DMARC_MISSING", level: "high", message: "DMARC was expected but was not reported in the supplied snapshot." });
  if (!findings.length) findings.push({ code: "SNAPSHOT_MATCH", level: "low", message: "Supplied DNS snapshot matches expected records; live propagation and authoritative nameservers were not queried." });
  return report(findings, [
    "This compares two supplied snapshots only; it does not query DNS or prove that the authoritative zone is correct.",
    "Never change nameservers or DNS records automatically. Require explicit owner approval and preserve rollback values.",
  ]);
}

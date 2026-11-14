import { isIP } from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "internal", "metadata.google.internal"]);

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168 || (b === 0 && c === 2))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113);
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  // Conservative allow-list: only global-unicast 2000::/3, excluding documentation space.
  if (!normalized.startsWith("2") && !normalized.startsWith("3")) return true;
  if (normalized.startsWith("2001:db8:")) return true;
  return false;
}

/**
 * Syntax-level SSRF guard for outbound HTTP clients.
 * A production egress adapter MUST additionally resolve DNS and validate every
 * resolved address at connection time, pin the validated address, and re-check redirects.
 */
export function validateOutboundHttpUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Outbound URL is invalid"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP and HTTPS outbound URLs are allowed");
  if (url.username || url.password) throw new Error("Outbound URL credentials are not allowed");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Outbound URL uses a non-standard port");
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!hostname || BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Outbound URL targets a blocked local hostname");
  }
  const ipVersion = isIP(hostname);
  if (ipVersion === 4 && isPrivateIpv4(hostname)) throw new Error("Outbound URL targets a non-public IPv4 address");
  if (ipVersion === 6 && isPrivateIpv6(hostname)) throw new Error("Outbound URL targets a non-public IPv6 address");
  return url;
}

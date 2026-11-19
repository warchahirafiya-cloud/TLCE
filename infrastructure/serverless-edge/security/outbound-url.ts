import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "internal", "metadata.google.internal"]);
const DEFAULT_MAX_REDIRECTS = 3;
const DEFAULT_MAX_RESPONSE_BYTES = 1_048_576;
const DEFAULT_TIMEOUT_MS = 10_000;

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113);
}

function ipv6Hextets(address: string): number[] | null {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized.includes(".")) return null; // IPv4-mapped and transition forms are denied.
  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (part: string): number[] | null => {
    if (!part) return [];
    const values = part.split(":");
    if (values.some((value) => !/^[0-9a-f]{1,4}$/.test(value))) return null;
    return values.map((value) => Number.parseInt(value, 16));
  };
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] ?? "");
  if (!left || !right) return null;
  if (halves.length === 1) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...Array(missing).fill(0), ...right];
}

function isPrivateIpv6(address: string): boolean {
  const groups = ipv6Hextets(address);
  if (!groups) return true;
  const [first, second] = groups;
  // Only global-unicast 2000::/3 is eligible. This rejects unspecified,
  // loopback, link-local, ULA, multicast, IPv4-mapped and transition ranges.
  if (first < 0x2000 || first > 0x3fff) return true;
  // Conservatively deny protocol-assignment, documentation, and 6to4 space.
  if (first === 0x2001 && second <= 0x01ff) return true; // 2001::/23
  if (first === 0x2001 && second === 0x0db8) return true; // 2001:db8::/32
  if (first === 0x2002) return true; // 6to4 embeds IPv4 destinations.
  if (first === 0x3fff && second <= 0x0fff) return true; // 3fff::/20 documentation
  return false;
}

function assertPublicAddress(address: string): number {
  const version = isIP(address);
  if (version === 4 && isPrivateIpv4(address)) throw new Error("Outbound URL resolves to a non-public IPv4 address");
  if (version === 6 && isPrivateIpv6(address)) throw new Error("Outbound URL resolves to a non-public IPv6 address");
  if (!version) throw new Error("DNS returned an invalid IP address");
  return version;
}

function normalizeHostname(url: URL): string {
  return url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
}

/** Syntax-only validation. Use fetchOutboundHttp for network requests to pin DNS and re-check redirects. */
export function validateOutboundHttpUrl(input: string): URL {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Outbound URL is invalid"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only HTTP and HTTPS outbound URLs are allowed");
  if (url.username || url.password) throw new Error("Outbound URL credentials are not allowed");
  if (url.port && !["80", "443"].includes(url.port)) throw new Error("Outbound URL uses a non-standard port");
  const hostname = normalizeHostname(url);
  if (!hostname || BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Outbound URL targets a blocked local hostname");
  }
  const version = isIP(hostname);
  if (version) assertPublicAddress(hostname);
  return url;
}

export type OutboundDnsResolver = (hostname: string) => Promise<LookupAddress[]>;

const defaultResolver: OutboundDnsResolver = async (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

/**
 * Resolve and validate every A/AAAA answer. A mixed public/private answer is rejected.
 * The selected address is subsequently pinned into the socket lookup callback.
 */
export async function resolvePublicOutboundUrl(
  input: string,
  resolver: OutboundDnsResolver = defaultResolver,
): Promise<{ url: URL; address: LookupAddress }> {
  const url = validateOutboundHttpUrl(input);
  const hostname = normalizeHostname(url);
  const version = isIP(hostname);
  const answers = version
    ? [{ address: hostname, family: version }]
    : await resolver(hostname);

  if (answers.length === 0) throw new Error("Outbound hostname did not resolve");
  for (const answer of answers) assertPublicAddress(answer.address);
  return { url, address: answers[0] };
}

export interface OutboundFetchOptions {
  method?: string;
  headers?: HeadersInit;
  body?: string | Uint8Array;
  signal?: AbortSignal;
  maxRedirects?: number;
  maxResponseBytes?: number;
  timeoutMs?: number;
  resolver?: OutboundDnsResolver;
}

/**
 * SSRF-resistant Node HTTP client:
 * - resolves and validates all DNS answers for each hop;
 * - pins the selected public IP in the socket lookup callback (prevents DNS rebinding);
 * - disables automatic redirects and re-validates every redirect target;
 * - blocks HTTPS-to-HTTP redirects and caps redirects, response bytes and request time.
 */
export async function fetchOutboundHttp(input: string, options: OutboundFetchOptions = {}): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 10) {
    throw new Error("Invalid outbound redirect limit");
  }
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 10_485_760) {
    throw new Error("Invalid outbound response size limit");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    throw new Error("Invalid outbound timeout");
  }

  let currentUrl = input;
  let method = (options.method || "GET").toUpperCase();
  let body = options.body;
  const headers = new Headers(options.headers);

  for (let redirectCount = 0; ; redirectCount += 1) {
    const { url, address } = await resolvePublicOutboundUrl(currentUrl, options.resolver);
    if (options.signal?.aborted) throw new Error("Outbound request was aborted");

    const response = await new Promise<Response>((resolve, reject) => {
      const hostname = normalizeHostname(url);
      const pinnedLookup = ((_: string, __: unknown, callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
        callback(null, address.address, address.family);
      }) as LookupFunction;
      const transport = url.protocol === "https:" ? httpsRequest : httpRequest;
      const requestHeaders = new Headers(headers);
      requestHeaders.set("host", url.host);
      const request = transport({
        protocol: url.protocol,
        hostname,
        port: url.port || undefined,
        method,
        path: url.pathname + url.search,
        headers: Object.fromEntries(requestHeaders.entries()),
        lookup: pinnedLookup,
        agent: false,
        ...(url.protocol === "https:" && !isIP(hostname) ? { servername: hostname } : {}),
      }, (incoming) => {
        const chunks: Buffer[] = [];
        let received = 0;
        incoming.on("data", (chunk: Buffer | Uint8Array) => {
          received += chunk.byteLength;
          if (received > maxResponseBytes) {
            request.destroy(new Error("Outbound response exceeded the size limit"));
            return;
          }
          chunks.push(Buffer.from(chunk));
        });
        incoming.on("end", () => {
          const responseHeaders = new Headers();
          for (const [key, value] of Object.entries(incoming.headers)) {
            if (typeof value === "string") responseHeaders.set(key, value);
            else if (Array.isArray(value)) responseHeaders.set(key, value.join(", "));
          }
          resolve(new Response(Buffer.concat(chunks), {
            status: incoming.statusCode || 502,
            headers: responseHeaders,
          }));
        });
        incoming.on("error", reject);
      });

      const abort = () => request.destroy(new Error("Outbound request was aborted"));
      options.signal?.addEventListener("abort", abort, { once: true });
      request.on("close", () => options.signal?.removeEventListener("abort", abort));
      request.setTimeout(timeoutMs, () => request.destroy(new Error("Outbound request timed out")));
      request.on("error", reject);
      if (body !== undefined) request.write(body);
      request.end();
    });

    const location = response.headers.get("location");
    const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
    if (!isRedirect || !location) return response;
    if (redirectCount >= maxRedirects) throw new Error("Outbound request exceeded the redirect limit");

    const nextUrl = new URL(location, url);
    validateOutboundHttpUrl(nextUrl.toString());
    if (url.protocol === "https:" && nextUrl.protocol !== "https:") {
      throw new Error("HTTPS-to-HTTP redirects are not allowed");
    }
    if (nextUrl.origin !== url.origin) {
      headers.delete("authorization");
      headers.delete("cookie");
      headers.delete("proxy-authorization");
    }
    if ([301, 302, 303].includes(response.status) && method !== "GET" && method !== "HEAD") {
      method = "GET";
      body = undefined;
      headers.delete("content-length");
      headers.delete("content-type");
    }
    currentUrl = nextUrl.toString();
  }
}

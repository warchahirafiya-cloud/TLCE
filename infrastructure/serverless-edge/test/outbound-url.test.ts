import test from "node:test";
import assert from "node:assert/strict";
import { validateOutboundHttpUrl, resolvePublicOutboundUrl } from "../security/outbound-url";

test("allows ordinary public HTTP and HTTPS URLs", () => {
  assert.equal(validateOutboundHttpUrl("https://example.com/path").hostname, "example.com");
  assert.equal(validateOutboundHttpUrl("http://example.org").protocol, "http:");
});

test("blocks non-HTTP protocols, credentials, and unusual ports", () => {
  for (const value of ["file:///etc/passwd", "ftp://example.com", "https://user:pass@example.com", "https://example.com:8443"]) {
    assert.throws(() => validateOutboundHttpUrl(value));
  }
});

test("blocks local hostnames and private or reserved IP ranges", () => {
  for (const value of [
    "http://localhost", "http://service.local", "http://internal",
    "http://127.0.0.1", "http://10.0.0.1", "http://172.16.0.1",
    "http://192.168.1.1", "http://169.254.169.254", "http://100.64.0.1",
    "http://[::1]", "http://[fc00::1]", "http://[fe80::1]", "http://[2002::1]",
    "http://[2001:db8::1]", "http://[2001:20::1]", "http://[3fff::1]",
    "http://[::ffff:127.0.0.1]", "http://[ff02::1]",
  ]) assert.throws(() => validateOutboundHttpUrl(value));
});

test("rejects malformed URLs", () => {
  assert.throws(() => validateOutboundHttpUrl("not a url"), /invalid/);
});

test("resolves a hostname and returns a validated pinned public address", async () => {
  const result = await resolvePublicOutboundUrl("https://example.com/resource", async (hostname) => {
    assert.equal(hostname, "example.com");
    return [{ address: "93.184.216.34", family: 4 }];
  });
  assert.equal(result.address.address, "93.184.216.34");
  assert.equal(result.address.family, 4);
});

test("rejects DNS answers containing any private address", async () => {
  await assert.rejects(
    resolvePublicOutboundUrl("https://rebind.example", async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]),
    /non-public IPv4/,
  );
});

test("rejects empty DNS answers", async () => {
  await assert.rejects(
    resolvePublicOutboundUrl("https://no-answer.example", async () => []),
    /did not resolve/,
  );
});

test("does not use DNS for an IP literal", async () => {
  const result = await resolvePublicOutboundUrl("https://93.184.216.34", async () => {
    throw new Error("resolver must not be called for IP literals");
  });
  assert.equal(result.address.address, "93.184.216.34");
});

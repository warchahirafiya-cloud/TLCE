import test from "node:test";
import assert from "node:assert/strict";
import { validateOutboundHttpUrl } from "../security/outbound-url";

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
    "http://[::1]", "http://[fc00::1]", "http://[fe80::1]",
  ]) assert.throws(() => validateOutboundHttpUrl(value));
});

test("rejects malformed URLs", () => {
  assert.throws(() => validateOutboundHttpUrl("not a url"), /invalid/);
});

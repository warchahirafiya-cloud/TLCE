import assert from "node:assert/strict";
import test from "node:test";
import type { ConnectionLifecycleRecord } from "../src/lifecycle.js";
import { transitionConnectionLifecycle } from "../src/lifecycle.js";

const base: ConnectionLifecycleRecord = {
  providerId: "sample-provider",
  tenantId: "tenant-a",
  lifecycle: "catalogued",
  connectionVerified: false,
  createdAt: 1,
  updatedAt: 1,
};

function reachConnected() {
  const reviewed = transitionConnectionLifecycle(base, "reviewed", 2);
  const pending = transitionConnectionLifecycle(reviewed, "consent_pending", 3);
  return transitionConnectionLifecycle(pending, "connected", 4, {
    connectionVerified: true,
    checkedAt: 4,
  });
}

test("requires review, consent and fresh verification before connected", () => {
  const connected = reachConnected();
  assert.equal(connected.connectionVerified, true);
  assert.equal(connected.lifecycle, "connected");
});

test("requires a successful health check before enabling", () => {
  const connected = reachConnected();
  assert.throws(() => transitionConnectionLifecycle(connected, "enabled"));
  const healthy = transitionConnectionLifecycle(connected, "health_checked");
  const enabled = transitionConnectionLifecycle(healthy, "enabled");
  assert.equal(enabled.lifecycle, "enabled");
  assert.equal(enabled.connectionVerified, true);
});

test("revocation is terminal and records its timestamp", () => {
  const revoked = transitionConnectionLifecycle(reachConnected(), "revoked", 99);
  assert.equal(revoked.revokedAt, 99);
  assert.equal(revoked.connectionVerified, false);
  assert.throws(() => transitionConnectionLifecycle(revoked, "reviewed"));
});

test("rejects skipping mandatory lifecycle stages", () => {
  assert.throws(() => transitionConnectionLifecycle(base, "connected"));
  assert.throws(() => transitionConnectionLifecycle(base, "enabled"));
});

test("does not infer verification and rejects stale evidence", () => {
  const reviewed = transitionConnectionLifecycle(base, "reviewed", 2);
  const pending = transitionConnectionLifecycle(reviewed, "consent_pending", 3);
  assert.throws(() => transitionConnectionLifecycle(pending, "connected", 4));
  assert.throws(() => transitionConnectionLifecycle(pending, "connected", 400_000, {
    connectionVerified: true,
    checkedAt: 1,
  }));
});

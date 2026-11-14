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

test("requires review and consent before a connection is marked connected", () => {
  const reviewed = transitionConnectionLifecycle(base, "reviewed", 2);
  const pending = transitionConnectionLifecycle(reviewed, "consent_pending", 3);
  const connected = transitionConnectionLifecycle(pending, "connected", 4);
  assert.equal(connected.connectionVerified, true);
  assert.equal(connected.lifecycle, "connected");
});

test("requires a successful health check before enabling", () => {
  const connected = transitionConnectionLifecycle(
    transitionConnectionLifecycle(
      transitionConnectionLifecycle(base, "reviewed"),
      "consent_pending",
    ),
    "connected",
  );
  assert.throws(() => transitionConnectionLifecycle(connected, "enabled"));
  const healthy = transitionConnectionLifecycle(connected, "health_checked");
  const enabled = transitionConnectionLifecycle(healthy, "enabled");
  assert.equal(enabled.lifecycle, "enabled");
  assert.equal(enabled.connectionVerified, true);
});

test("revocation is terminal and records its timestamp", () => {
  const connected = transitionConnectionLifecycle(
    transitionConnectionLifecycle(
      transitionConnectionLifecycle(base, "reviewed"),
      "consent_pending",
    ),
    "connected",
  );
  const revoked = transitionConnectionLifecycle(connected, "revoked", 99);
  assert.equal(revoked.revokedAt, 99);
  assert.throws(() => transitionConnectionLifecycle(revoked, "reviewed"));
});

test("rejects skipping mandatory lifecycle stages", () => {
  assert.throws(() => transitionConnectionLifecycle(base, "connected"));
  assert.throws(() => transitionConnectionLifecycle(base, "enabled"));
});

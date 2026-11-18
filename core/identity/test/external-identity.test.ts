import test from "node:test";
import assert from "node:assert/strict";
import {
  ExternalIdentityDisabledError,
  ExternalIdentityNotLinkedError,
  resolveLinkedExternalIdentity,
} from "../src/external-identity";

const verified = {
  provider: "github" as const,
  providerSubject: "334682116",
  verifiedAt: "2026-11-18T12:00:00.000Z",
};

test("maps a provider-verified stable account ID to an existing TLCE subject", async () => {
  const result = await resolveLinkedExternalIdentity(verified, {
    findLink: async (provider, providerSubject) => {
      assert.equal(provider, "github");
      assert.equal(providerSubject, "334682116");
      return { tlceSubject: "tlce-subject-001", active: true };
    },
  });
  assert.deepEqual(result, { subject: "tlce-subject-001" });
});

test("does not auto-provision an unlinked external account", async () => {
  await assert.rejects(
    resolveLinkedExternalIdentity(verified, { findLink: async () => null }),
    ExternalIdentityNotLinkedError,
  );
});

test("rejects disabled account links", async () => {
  await assert.rejects(
    resolveLinkedExternalIdentity(verified, {
      findLink: async () => ({ tlceSubject: "tlce-subject-001", active: false }),
    }),
    ExternalIdentityDisabledError,
  );
});

test("rejects usernames and malformed provider subjects as identity keys", async () => {
  await assert.rejects(
    resolveLinkedExternalIdentity({ ...verified, providerSubject: "some-user-name" }, {
      findLink: async () => ({ tlceSubject: "tlce-subject-001", active: true }),
    }),
    /Invalid verified external identity/,
  );
});

test("rejects invalid TLCE subject mappings", async () => {
  await assert.rejects(
    resolveLinkedExternalIdentity(verified, {
      findLink: async () => ({ tlceSubject: " tlce-subject-001", active: true }),
    }),
    /Invalid TLCE subject mapping/,
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import { authorizeSpaceAction, type SpaceAclContext, type SpaceAction } from "../src/authorization.js";

const base = (overrides: Partial<SpaceAclContext> = {}): SpaceAclContext => ({
  actorId: "user-a",
  space: { id: "space-a", status: "active", visibility: "private" },
  membership: { spaceId: "space-a", userId: "user-a", role: "owner" },
  item: { id: "item-a", spaceId: "space-a", createdBy: "user-a", visibility: "restricted", status: "published" },
  now: Date.parse("2026-11-27T00:00:00Z"),
  ...overrides,
});
const allowed = (context: SpaceAclContext, action: SpaceAction) =>
  authorizeSpaceAction(context, action).allowed;

test("owner has full Space and content authority", () => {
  for (const action of ["space:delete", "members:manage", "items:publish", "comments:moderate"] as const) {
    assert.equal(allowed(base(), action), true, action);
  }
});

test("admin cannot delete the Space", () => {
  const context = base({ membership: { spaceId: "space-a", userId: "user-a", role: "admin" } });
  assert.equal(allowed(context, "space:update"), true);
  assert.equal(allowed(context, "members:manage"), true);
  assert.equal(allowed(context, "space:delete"), false);
});

test("viewer is read-only and cannot mutate content or membership", () => {
  const context = base({ membership: { spaceId: "space-a", userId: "user-a", role: "viewer" } });
  assert.equal(allowed(context, "items:read"), true);
  assert.equal(allowed(context, "assets:download"), true);
  assert.equal(allowed(context, "items:update"), false);
  assert.equal(allowed(context, "comments:create"), false);
  assert.equal(allowed(context, "members:manage"), false);
});

test("editor may mutate own item but not another member's item", () => {
  const membership = { spaceId: "space-a", userId: "user-a", role: "editor" as const };
  assert.equal(allowed(base({ membership }), "items:update"), true);
  assert.equal(allowed(base({ membership, item: { id: "item-b", spaceId: "space-a", createdBy: "user-b", visibility: "restricted", status: "published" } }), "items:update"), false);
  assert.equal(allowed(base({ membership, item: null }), "items:update"), false);
});

test("cross-tenant membership and item substitution are denied", () => {
  const wrongMembership = base({ membership: { spaceId: "space-b", userId: "user-a", role: "owner" } });
  assert.equal(allowed(wrongMembership, "items:read"), false);
  const wrongItem = base({ item: { id: "foreign-item", spaceId: "space-b", createdBy: "user-a", visibility: "public", status: "published" } });
  assert.equal(authorizeSpaceAction(wrongItem, "items:read").reason, "resource-scope-mismatch");
});

test("user B cannot access user A private Space resources", () => {
  const userB = base({
    actorId: "user-b",
    membership: null,
    grants: [],
  });
  for (const action of ["space:read", "items:read", "items:update", "items:delete", "comments:create", "assets:download"] as const) {
    assert.equal(allowed(userB, action), false, action);
  }
});

test("item-scoped grants cannot be replayed against another item or Space", () => {
  const grant = { spaceId: "space-a", itemId: "item-a", subjectUserId: "user-b", permission: "view" as const, expiresAt: null };
  const userB = base({ actorId: "user-b", membership: null, grants: [grant] });
  assert.equal(allowed(userB, "items:read"), true);
  assert.equal(allowed(base({ actorId: "user-b", membership: null, grants: [grant], item: { id: "item-x", spaceId: "space-a", createdBy: "user-a", visibility: "restricted", status: "published" } }), "items:read"), false);
  assert.equal(allowed(base({ actorId: "user-b", membership: null, grants: [{ ...grant, spaceId: "space-b" }] }), "items:read"), false);
});

test("expired and malformed grants fail closed", () => {
  const expired = { spaceId: "space-a", itemId: "item-a", subjectUserId: "user-b", permission: "view" as const, expiresAt: "2026-11-26T23:59:59Z" };
  const malformed = { ...expired, expiresAt: "not-a-date" };
  assert.equal(allowed(base({ actorId: "user-b", membership: null, grants: [expired] }), "items:read"), false);
  assert.equal(allowed(base({ actorId: "user-b", membership: null, grants: [malformed] }), "items:read"), false);
});

test("grant permissions are narrow and never grant Space administration", () => {
  const grant = { spaceId: "space-a", itemId: null, subjectUserId: "user-b", permission: "manage" as const, expiresAt: null };
  const userB = base({ actorId: "user-b", membership: null, grants: [grant] });
  assert.equal(allowed(userB, "items:update"), true);
  assert.equal(allowed(userB, "items:delete"), true);
  assert.equal(allowed(userB, "members:manage"), false);
  assert.equal(allowed(userB, "space:delete"), false);
});

test("anonymous access is limited to published public/unlisted content in public/unlisted Spaces", () => {
  const anonymous = base({
    actorId: null,
    membership: null,
    space: { id: "space-a", status: "active", visibility: "public" },
    item: { id: "item-a", spaceId: "space-a", createdBy: "user-a", visibility: "public", status: "published" },
  });
  assert.equal(allowed(anonymous, "items:read"), true);
  assert.equal(allowed(anonymous, "assets:download"), true);
  assert.equal(allowed({ ...anonymous, space: { ...anonymous.space, visibility: "private" } }, "items:read"), false);
  assert.equal(allowed({ ...anonymous, item: { ...anonymous.item!, status: "draft" } }, "items:read"), false);
  assert.equal(allowed({ ...anonymous, item: { ...anonymous.item!, visibility: "restricted" } }, "items:read"), false);
});

test("unlisted is direct-link visibility, not permission to appear in discovery", () => {
  const anonymous = base({
    actorId: null,
    membership: null,
    space: { id: "space-a", status: "active", visibility: "unlisted" },
    item: { id: "item-a", spaceId: "space-a", createdBy: "user-a", visibility: "unlisted", status: "published" },
  });
  assert.equal(allowed(anonymous, "items:read"), true);
  assert.equal(allowed(anonymous, "items:create"), false);
});

test("inactive Spaces and archived/deleted items fail closed", () => {
  assert.equal(allowed(base({ space: { id: "space-a", status: "archived", visibility: "public" } }), "items:read"), false);
  assert.equal(allowed(base({ item: { id: "item-a", spaceId: "space-a", createdBy: "user-a", visibility: "public", status: "deleted" } }), "items:read"), false);
});

test("missing principal cannot perform protected actions", () => {
  assert.equal(allowed(base({ actorId: null, membership: null }), "items:update"), false);
  assert.equal(allowed(base({ actorId: null, membership: null }), "members:manage"), false);
});

export type SpaceRole = "owner" | "admin" | "editor" | "viewer";
export type SpaceVisibility = "private" | "unlisted" | "public";
export type ItemVisibility = "private" | "restricted" | "unlisted" | "public";
export type SpaceAction =
  | "space:read" | "space:update" | "space:delete"
  | "members:read" | "members:manage"
  | "items:create" | "items:read" | "items:update" | "items:delete" | "items:publish"
  | "comments:create" | "comments:moderate"
  | "assets:read" | "assets:upload" | "assets:download"
  | "ratings:create";
export type GrantPermission = "view" | "comment" | "edit" | "manage" | "download";

export interface SpaceAclContext {
  actorId: string | null;
  space: { id: string; status: "active" | "archived" | "deleted"; visibility: SpaceVisibility };
  membership?: { spaceId: string; userId: string; role: SpaceRole } | null;
  item?: {
    id: string; spaceId: string; createdBy: string; visibility: ItemVisibility;
    status: "draft" | "published" | "archived" | "deleted";
  } | null;
  grants?: ReadonlyArray<{
    spaceId: string; itemId: string | null; subjectUserId: string;
    permission: GrantPermission; expiresAt: string | null;
  }>;
  /** Injected clock makes expiry decisions deterministic and testable. */
  now?: number;
}

export interface SpaceAclDecision {
  allowed: boolean;
  reason:
    | "allowed-role" | "allowed-grant" | "allowed-public" | "missing-principal"
    | "inactive-space" | "resource-scope-mismatch" | "item-unavailable"
    | "visibility-denied" | "role-denied" | "grant-denied";
}

const ROLE_ACTIONS: Record<SpaceRole, ReadonlySet<SpaceAction>> = {
  owner: new Set<SpaceAction>([
    "space:read", "space:update", "space:delete", "members:read", "members:manage",
    "items:create", "items:read", "items:update", "items:delete", "items:publish",
    "comments:create", "comments:moderate", "assets:read", "assets:upload",
    "assets:download", "ratings:create",
  ]),
  admin: new Set<SpaceAction>([
    "space:read", "space:update", "members:read", "members:manage",
    "items:create", "items:read", "items:update", "items:delete", "items:publish",
    "comments:create", "comments:moderate", "assets:read", "assets:upload",
    "assets:download", "ratings:create",
  ]),
  editor: new Set<SpaceAction>([
    "space:read", "items:create", "items:read", "items:update", "items:delete",
    "items:publish", "comments:create", "assets:read", "assets:upload",
    "assets:download", "ratings:create",
  ]),
  viewer: new Set<SpaceAction>([
    "space:read", "items:read", "assets:read", "assets:download", "ratings:create",
  ]),
};

const READ_ACTIONS = new Set<SpaceAction>([
  "space:read", "items:read", "assets:read", "assets:download",
]);

const ITEM_REQUIRED_ACTIONS = new Set<SpaceAction>([
  "items:read", "items:update", "items:delete", "items:publish",
  "comments:create", "comments:moderate", "assets:read", "assets:upload", "assets:download",
]);

function deny(reason: SpaceAclDecision["reason"]): SpaceAclDecision {
  return { allowed: false, reason };
}

function grantAllows(context: SpaceAclContext, action: SpaceAction): boolean {
  if (!context.actorId) return false;
  const itemId = context.item?.id ?? null;
  const now = context.now ?? Date.now();
  return (context.grants ?? []).some((grant) => {
    if (grant.subjectUserId !== context.actorId || grant.spaceId !== context.space.id) return false;
    if (grant.itemId !== null && grant.itemId !== itemId) return false;
    if (grant.expiresAt !== null) {
      const expiresAt = Date.parse(grant.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
    }
    switch (grant.permission) {
      case "view": return action === "space:read" || action === "items:read" || action === "assets:read";
      case "comment": return action === "items:read" || action === "comments:create";
      case "edit": return action === "items:read" || action === "items:update";
      // "manage" is content-scoped; it never grants Space or membership administration.
      case "manage": return action === "items:read" || action === "items:update" || action === "items:delete" || action === "items:publish";
      case "download": return action === "assets:download";
      default: return false;
    }
  });
}

/**
 * Deterministic policy evaluator only. Callers must authenticate the actor and
 * load membership, grants, Space and item using tenant-scoped server-side queries.
 */
export function authorizeSpaceAction(context: SpaceAclContext, action: SpaceAction): SpaceAclDecision {
  if (context.space.status !== "active") return deny("inactive-space");

  if (ITEM_REQUIRED_ACTIONS.has(action) && !context.item) return deny("item-unavailable");

  if (context.item) {
    if (context.item.spaceId !== context.space.id) return deny("resource-scope-mismatch");
    if (context.item.status === "archived" || context.item.status === "deleted") {
      return deny("item-unavailable");
    }
  }

  const membership = context.membership ?? null;
  const isMember = !!context.actorId && !!membership &&
    membership.userId === context.actorId && membership.spaceId === context.space.id;

  if (!context.actorId) {
    if (!READ_ACTIONS.has(action)) return deny("missing-principal");
    if (context.space.visibility === "private") return deny("visibility-denied");
    if (action === "space:read") return { allowed: true, reason: "allowed-public" };
    if (!context.item || context.item.status !== "published") return deny("item-unavailable");
    if (context.item.visibility !== "public" && context.item.visibility !== "unlisted") {
      return deny("visibility-denied");
    }
    return { allowed: true, reason: "allowed-public" };
  }

  if (context.item?.visibility === "private" && isMember && membership) {
    const privileged = membership.role === "owner" || membership.role === "admin";
    const creator = context.item.createdBy === context.actorId;
    if (!privileged && !creator && !grantAllows(context, action)) return deny("visibility-denied");
  }

  if (context.item?.status === "draft" && action === "items:read") {
    const privileged = !!membership && isMember &&
      (membership.role === "owner" || membership.role === "admin");
    const creator = !!membership && isMember && membership.role === "editor" &&
      context.item.createdBy === context.actorId;
    if (!privileged && !creator && !grantAllows(context, action)) return deny("item-unavailable");
  }

  if (membership && isMember && ROLE_ACTIONS[membership.role].has(action)) {
    if (membership.role === "editor" &&
        (action === "items:update" || action === "items:delete" || action === "items:publish") &&
        (!context.item || context.item.createdBy !== context.actorId)) {
      return deny("role-denied");
    }
    return { allowed: true, reason: "allowed-role" };
  }

  if (grantAllows(context, action)) return { allowed: true, reason: "allowed-grant" };
  return deny(isMember ? "role-denied" : "grant-denied");
}

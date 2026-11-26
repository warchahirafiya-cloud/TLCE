# TLCE Spaces P2 — Zero-Trust Authorization Contract

**Status:** P2 design and policy contract; implementation is intentionally staged.  
**Baseline:** P1 schema commit `8922d64bea415f8613b9d9f46bb960bbc10d0e8e`.  
**Scope:** authorization semantics and a transport/database-independent policy evaluator. This document does not claim a deployed Spaces API, D1 binding, identity provider integration, or production enforcement.

## 1. Security invariants

1. **Authenticate before authorize.** A valid identity assertion establishes a principal; it does not grant access to a Space.
2. **Deny by default.** Missing principal, membership, grant, resource scope, or policy context denies the operation.
3. **Tenant scope is part of every resource lookup.** Fetch an item, asset, comment, rating, or grant using its `space_id` and resource ID together. Never load by resource ID alone and authorize later.
4. **Authorization is server-side and per request.** Browser capabilities, route visibility, request-body owner IDs, and client-supplied role values are untrusted.
5. **Parent visibility is an upper bound.** A public item cannot make a private Space public.
6. **No shared caching of protected data.** P2 responses are `Cache-Control: private, no-store`. No KV/CDN/shared response cache is introduced in this phase.
7. **Non-enumeration.** A resource outside the principal's accessible scope returns the same not-found result as a nonexistent resource. Authenticated members who lack an operation may receive 403; cross-tenant and inaccessible private resources return 404.
8. **Fail closed.** Identity verification, D1 reads, grant evaluation, or policy failures must never fall back to public access.

## 2. Role matrix

The P1 schema defines `owner`, `admin`, `editor`, and `viewer`. P2 retains all four roles.

| Capability | Owner | Admin | Editor | Viewer |
|---|---:|---:|---:|---:|
| Read Space and accessible items | Yes | Yes | Yes | Yes |
| Update Space metadata | Yes | Yes | No | No |
| Delete Space | Yes | No | No | No |
| Manage members and roles | Yes | Yes (never owner transfer/removal) | No | No |
| Create items | Yes | Yes | Yes | No |
| Read published items | Yes | Yes | Yes | Yes |
| Update/delete/publish any item | Yes | Yes | No | No |
| Update/delete/publish own items | Yes | Yes | Yes | No |
| Moderate comments | Yes | Yes | No | No |
| Create comments | Yes | Yes | Yes | No |
| Upload assets | Yes | Yes | Yes | No |
| Read/download permitted assets | Yes | Yes | Yes | Yes |
| Create ratings | Yes | Yes | Yes | Yes |

**Role constraints**
- The owner is immutable under P1. Owner transfer is not implemented by P2.
- Admin cannot delete the Space, transfer ownership, or remove/demote the owner.
- Editor item mutations are limited to items whose server-loaded `created_by` equals the authenticated principal.
- Viewer is read-only unless a specific grant adds a narrower action.
- Role membership must be loaded from D1 for the exact `(space_id, user_id)`; never accept it from a JWT custom claim or request body.

## 3. Explicit access grants

P1 `access_grants` are additive, subject-specific grants, not role assignments:

| Grant | Effect | Boundary |
|---|---|---|
| `view` | Read the granted Space/item and its permitted content | Never grants membership administration |
| `comment` | Create comments in the granted scope | Never grants item or Space editing |
| `edit` | Update content in the granted scope | Never grants member/role management or Space deletion |
| `manage` | Manage content (update/delete/publish) in the granted scope | Never grants owner/admin powers or membership/Space administration |
| `download` | Download permitted assets in the granted scope | Does not expose quarantine objects or raw R2 keys |

- A grant matches only when `subject_user_id`, `space_id`, and optional `item_id` match the authenticated principal and requested resource.
- A Space-scoped grant (`item_id IS NULL`) applies to content in that Space; an item-scoped grant never crosses item or Space boundaries.
- Expired grants are ignored. Invalid expiry values fail closed.
- Revocation takes effect on the next authorization decision; P2 introduces no authorization-result cache.

## 4. Visibility and lifecycle

- `private` Space: no anonymous access. Membership or a valid subject grant is required.
- `public` Space: anonymous read of published, public items only.
- `unlisted` Space: direct-link read of published public/unlisted items; it must be excluded from discovery and search listings. Unlisted is not a substitute for private access control.
- Item `private`: only owner/admin, its creator where applicable, or an explicit matching grant can read it.
- Item `restricted`: authenticated Space members or explicit grants may read it.
- Item `public`/`unlisted`: anonymous read is possible only when the parent Space is also public/unlisted and the item is published.
- Archived/deleted Spaces and archived/deleted items are denied by this P2 policy until a separate lifecycle policy explicitly defines read-only archival behavior.
- Draft items are not anonymously readable.

## 5. Identity and request boundary

The existing Integration Worker verifies Cloudflare Access JWTs only for `GET /api/search`. It is not a Spaces authentication integration. The current Spaces schema accepts opaque identity IDs but does not define an issuer-to-user mapping.

Before an internet-facing Spaces route is enabled, the implementation must:
1. Select and document the trusted identity issuer for Spaces.
2. Verify signature, fixed algorithm, issuer, audience, expiry, not-before, and key rotation.
3. Derive a stable, issuer-namespaced subject; do not assume an email address or arbitrary JWT `sub` is already the application's canonical user ID.
4. Resolve that external subject to the opaque internal principal ID used by `spaces.owner_id`, `space_members.user_id`, and `access_grants.subject_user_id`.
5. Build the principal exclusively from verified server-side claims and the trusted identity mapping.

The identity provider and subject-mapping mechanism remain an explicit integration gate. P2 policy code must not invent either.

## 6. Data-access and route enforcement contract

Every Spaces handler must use a repository method that scopes reads and writes by both Space and resource identifiers. Examples:

- Item read: `WHERE space_id = ? AND id = ?`.
- Membership: `WHERE space_id = ? AND user_id = ?`.
- Asset delivery: resolve asset and item with matching `space_id`; then authorize `assets:download`; only then create a short-lived delivery response.
- Mutation: authorize first, then perform a conditional write that repeats the `space_id` predicate. Check affected-row count.
- Grants: load only grants matching the verified subject and requested Space/item scope.

No endpoint may accept `owner_id`, `user_id`, `role`, or an authorization decision from the client as authoritative.

P2 must cover every implemented read/write path: Space metadata, membership, items, comments, ratings, asset metadata, asset download, and grant management. An unimplemented route is not considered protected; it must remain absent/disabled.

## 7. Cache and response policy

- P2 uses no shared cache for Spaces responses: `Cache-Control: private, no-store`.
- Do not cache ACL decisions, membership lookups, grants, private DTOs, or signed URLs in KV/CDN.
- If public caching is introduced in a later phase, only anonymous published public content may be cached, keyed by canonical resource/version and visibility state. Protected routes must authorize before any cache lookup or response reuse.
- `Vary: Cookie` or `Vary: Authorization` alone is not an acceptable substitute for disabling shared caching of protected responses.

## 8. Required negative and boundary tests

The release gate must include at least:
- User B cannot read, list, update, delete, comment on, rate, or download User A's private Space resources.
- Substituting an item ID from another Space fails even when the caller knows the ID.
- Item-scoped grants cannot be replayed against another item or Space.
- Expired, revoked, malformed, or wrong-subject grants deny access.
- Viewer cannot mutate; editor cannot mutate another editor's item; admin cannot delete the Space or alter the owner.
- Anonymous access cannot read private/restricted content, drafts, or assets in quarantine.
- Public/unlisted visibility never overrides a private parent Space; unlisted content is excluded from discovery.
- A D1/repository failure denies protected operations.
- Protected responses are no-store and no shared cache key can serve one principal's content to another.

Tests against an in-memory policy evaluator prove policy semantics only. They do not prove D1 query scoping, JWT verification, Worker route coverage, Cloudflare D1 compatibility, or production deployment.

## 9. Delivery stages and gates

- **P2a (this change):** policy contract, deterministic ACL evaluator, unit tests for role/grant/visibility semantics.
- **P2b:** trusted identity issuer and subject mapping, Spaces-specific repository interface, D1 adapter with tenant-scoped SQL and integration tests.
- **P2c:** dedicated Spaces Worker/router; register every implemented route behind authentication and ACL; route-level negative tests and no-store headers.
- **P2d:** security review of route coverage, tenant-isolation tests, cache policy, and deployment configuration. No production binding or deployment until separately verified and approved.

## 10. Explicit non-claims

This P2a change does not establish a deployed Spaces API, Cloudflare Access integration for Spaces, D1 binding/migration, R2 delivery security, cache isolation in a live CDN, or production readiness.

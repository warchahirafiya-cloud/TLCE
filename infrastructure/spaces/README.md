# TLCE Spaces — D1 schema foundation

This directory contains the isolated D1/SQLite persistence foundation for TLCE Spaces.

## Migration

- `migrations/0001_spaces_core.sql` creates spaces, memberships, items, scoped access grants, item assets, comments, and ratings.
- IDs for authenticated users are opaque strings supplied by a trusted identity layer. There is intentionally no client-writable users table.
- Space creation inserts the owner membership in the same database transaction through a trigger.
- Owner membership cannot be directly deleted or reassigned; an internal deletion marker allows the membership to be removed only as part of its parent space's `ON DELETE CASCADE` transaction.
- Item-scoped grants, assets, comments, and ratings use composite foreign keys so an item cannot be referenced under a different space.
- `unlisted` is a direct-link visibility mode; discovery endpoints must exclude it.
- R2 object keys are unique and internal. Do not expose them in public DTOs.
- The schema is a data-integrity foundation, not an authorization implementation. Every API operation must still enforce authenticated ACL checks.

## Local validation

Run the executable SQLite/D1 integrity suite with Python's standard library:

```sh
python3 -m unittest discover -s infrastructure/spaces/test -p '*_test.py' -v
```

The same suite is part of the GitHub Actions CI workflow.


The migration is SQLite-compatible and can be checked without a Cloudflare account using SQLite:

```sh
sqlite3 :memory: < infrastructure/spaces/migrations/0001_spaces_core.sql
```

For a real local D1 execution, first add a dedicated D1 database binding and migrations directory to a Spaces-specific Wrangler configuration. Do not reuse or modify the existing production-worker configuration as part of this schema-only phase. No remote D1 database is created or migrated by this change.

## Deliberate P1 boundaries

- No D1 database/resource creation, remote migration, Worker binding, deployment, or DNS change.
- No authentication middleware or API ACL behavior (P2).
- No upload signing, Queue consumer, scanner, or R2 object movement (P3–P5).
- No claim of malware scanning, private-media delivery, or production readiness.

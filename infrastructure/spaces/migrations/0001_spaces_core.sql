-- TLCE Spaces Core — D1 / SQLite migration 0001
-- Additive, isolated schema. Does not create or modify Cloudflare resources.
-- Identity IDs are opaque strings issued by the trusted authentication layer;
-- this migration intentionally does not invent a local users table.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS spaces (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL CHECK (length(trim(owner_id)) BETWEEN 1 AND 160),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 3 AND 80),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 2000),
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('private', 'unlisted', 'public')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at TEXT,
  CHECK ((status = 'deleted' AND deleted_at IS NOT NULL) OR
         (status <> 'deleted' AND deleted_at IS NULL))
);

CREATE TABLE IF NOT EXISTS space_members (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  added_by TEXT NOT NULL CHECK (length(trim(added_by)) BETWEEN 1 AND 160),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (space_id, user_id)
);

CREATE TABLE IF NOT EXISTS space_items (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL CHECK (length(trim(created_by)) BETWEEN 1 AND 160),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 180),
  item_type TEXT NOT NULL CHECK (item_type IN ('post', 'link', 'file', 'collection', 'note')),
  body TEXT NOT NULL DEFAULT '' CHECK (length(body) <= 50000),
  external_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'restricted'
    CHECK (visibility IN ('private', 'restricted', 'unlisted', 'public')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived', 'deleted')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (space_id, id),
  CHECK (external_url IS NULL OR
    (length(external_url) <= 2048 AND
     (external_url LIKE 'https://%' OR external_url LIKE 'http://%')))
);

CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  item_id TEXT,
  subject_user_id TEXT NOT NULL CHECK (length(trim(subject_user_id)) BETWEEN 1 AND 160),
  permission TEXT NOT NULL
    CHECK (permission IN ('view', 'comment', 'edit', 'manage', 'download')),
  granted_by TEXT NOT NULL CHECK (length(trim(granted_by)) BETWEEN 1 AND 160),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (space_id, item_id) REFERENCES space_items(space_id, id) ON DELETE CASCADE,
  CHECK (expires_at IS NULL OR length(expires_at) >= 20)
);

CREATE TABLE IF NOT EXISTS space_assets (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  uploader_id TEXT NOT NULL CHECK (length(trim(uploader_id)) BETWEEN 1 AND 160),
  r2_key TEXT NOT NULL UNIQUE CHECK (length(r2_key) BETWEEN 1 AND 1024),
  original_name TEXT NOT NULL CHECK (length(trim(original_name)) BETWEEN 1 AND 255),
  content_type TEXT NOT NULL CHECK (content_type IN (
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'text/plain', 'application/zip'
  )),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 52428800),
  sha256_hash TEXT CHECK (sha256_hash IS NULL OR
    (length(sha256_hash) = 64 AND sha256_hash NOT GLOB '*[^0-9a-f]*')),
  storage_state TEXT NOT NULL DEFAULT 'quarantine'
    CHECK (storage_state IN ('quarantine', 'published', 'deleting', 'deleted')),
  scan_status TEXT NOT NULL DEFAULT 'quarantined'
    CHECK (scan_status IN ('quarantined', 'processing', 'clean', 'rejected', 'failed')),
  scan_attempts INTEGER NOT NULL DEFAULT 0 CHECK (scan_attempts >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (space_id, item_id) REFERENCES space_items(space_id, id) ON DELETE CASCADE,
  CHECK (
    (storage_state = 'published' AND scan_status = 'clean') OR
    (storage_state <> 'published')
  )
);

CREATE TABLE IF NOT EXISTS space_comments (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  user_id TEXT NOT NULL CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  parent_comment_id TEXT,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  status TEXT NOT NULL DEFAULT 'visible'
    CHECK (status IN ('visible', 'hidden', 'deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (space_id, item_id, id),
  FOREIGN KEY (space_id, item_id) REFERENCES space_items(space_id, id) ON DELETE CASCADE,
  FOREIGN KEY (space_id, item_id, parent_comment_id)
    REFERENCES space_comments(space_id, item_id, id) ON DELETE CASCADE,
  CHECK (parent_comment_id IS NULL OR parent_comment_id <> id)
);

CREATE TABLE IF NOT EXISTS space_ratings (
  id TEXT PRIMARY KEY NOT NULL,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  item_id TEXT,
  user_id TEXT NOT NULL CHECK (length(trim(user_id)) BETWEEN 1 AND 160),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT NOT NULL DEFAULT '' CHECK (length(review) <= 2000),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (space_id, item_id) REFERENCES space_items(space_id, id) ON DELETE CASCADE
);

-- One owner membership is created atomically with each space.
CREATE TRIGGER IF NOT EXISTS spaces_create_owner_membership
AFTER INSERT ON spaces
BEGIN
  INSERT INTO space_members (id, space_id, user_id, role, added_by)
  VALUES ('owner:' || NEW.id, NEW.id, NEW.owner_id, 'owner', NEW.owner_id);
END;

-- Keep the canonical owner membership from being removed or reassigned.
CREATE TRIGGER IF NOT EXISTS space_owner_membership_no_delete
BEFORE DELETE ON space_members
WHEN OLD.role = 'owner'
BEGIN
  SELECT RAISE(ABORT, 'space owner membership cannot be deleted');
END;

CREATE TRIGGER IF NOT EXISTS space_owner_membership_no_reassign
BEFORE UPDATE OF space_id, user_id, role ON space_members
WHEN OLD.role = 'owner'
BEGIN
  SELECT RAISE(ABORT, 'space owner membership cannot be reassigned');
END;

CREATE TRIGGER IF NOT EXISTS space_members_owner_role_guard
BEFORE INSERT ON space_members
WHEN NEW.role = 'owner'
 AND NOT EXISTS (SELECT 1 FROM spaces WHERE id = NEW.space_id AND owner_id = NEW.user_id)
BEGIN
  SELECT RAISE(ABORT, 'only the space owner may hold the owner role');
END;

-- The owner identity and owner membership cannot silently diverge.
CREATE TRIGGER IF NOT EXISTS spaces_owner_immutable
BEFORE UPDATE OF owner_id ON spaces
WHEN NEW.owner_id <> OLD.owner_id
BEGIN
  SELECT RAISE(ABORT, 'space owner is immutable');
END;

CREATE INDEX IF NOT EXISTS spaces_owner_status_idx
  ON spaces(owner_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS spaces_discovery_idx
  ON spaces(visibility, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS space_members_user_idx
  ON space_members(user_id, space_id);
CREATE INDEX IF NOT EXISTS space_items_space_status_idx
  ON space_items(space_id, status, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS space_items_discovery_idx
  ON space_items(visibility, status, created_at DESC);
CREATE INDEX IF NOT EXISTS access_grants_subject_space_idx
  ON access_grants(subject_user_id, space_id, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS access_grants_space_unique
  ON access_grants(space_id, subject_user_id, permission)
  WHERE item_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS access_grants_item_unique
  ON access_grants(space_id, item_id, subject_user_id, permission)
  WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS space_assets_item_idx
  ON space_assets(space_id, item_id, created_at);
CREATE INDEX IF NOT EXISTS space_assets_scan_queue_idx
  ON space_assets(scan_status, created_at)
  WHERE scan_status IN ('quarantined', 'failed');
CREATE INDEX IF NOT EXISTS space_comments_item_created_idx
  ON space_comments(space_id, item_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS space_ratings_space_user_unique
  ON space_ratings(space_id, user_id)
  WHERE item_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS space_ratings_item_user_unique
  ON space_ratings(space_id, item_id, user_id)
  WHERE item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS space_ratings_item_idx
  ON space_ratings(space_id, item_id, rating);

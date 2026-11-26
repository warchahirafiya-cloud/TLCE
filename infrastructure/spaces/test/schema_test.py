"""Executable integrity tests for the TLCE Spaces SQLite/D1 migration.

These tests use Python's standard-library sqlite3 module so CI needs no
Cloudflare credentials, remote D1 database, or third-party test dependency.
"""
from pathlib import Path
import sqlite3
import unittest


ROOT = Path(__file__).resolve().parents[3]
MIGRATION = ROOT / "infrastructure" / "spaces" / "migrations" / "0001_spaces_core.sql"


class SpacesSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(MIGRATION.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    def create_space(self, space_id="space-1", owner="user-1", slug="alpha"):
        self.db.execute(
            "INSERT INTO spaces (id, owner_id, name, slug) VALUES (?, ?, ?, ?)",
            (space_id, owner, "Alpha Space", slug),
        )

    def create_item(self, item_id="item-1", space_id="space-1"):
        self.db.execute(
            """INSERT INTO space_items
               (id, space_id, created_by, title, item_type)
               VALUES (?, ?, 'user-1', 'Item', 'post')""",
            (item_id, space_id),
        )

    def test_migration_creates_expected_tables_and_indexes(self):
        tables = {
            row[0] for row in self.db.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
        self.assertTrue({
            "spaces", "space_members", "space_items", "access_grants",
            "space_assets", "space_comments", "space_ratings",
        }.issubset(tables))
        self.assertGreaterEqual(
            self.db.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index'"
            ).fetchone()[0],
            10,
        )

    def test_space_creation_atomically_creates_owner_membership(self):
        self.create_space()
        owner = self.db.execute(
            "SELECT user_id, role, added_by FROM space_members WHERE space_id = ?",
            ("space-1",),
        ).fetchone()
        self.assertEqual(owner, ("user-1", "owner", "user-1"))

    def test_owner_membership_cannot_be_deleted_or_reassigned(self):
        self.create_space()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM space_members WHERE space_id = 'space-1'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                "UPDATE space_members SET user_id = 'attacker' WHERE space_id = 'space-1'"
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO space_members
                   (id, space_id, user_id, role, added_by)
                   VALUES ('fake-owner', 'space-1', 'attacker', 'owner', 'attacker')"""
            )

    def test_space_cascade_delete_removes_owner_membership_and_children(self):
        self.create_space()
        self.create_item()
        self.db.execute("DELETE FROM spaces WHERE id = 'space-1'")
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM space_members").fetchone()[0], 0
        )
        self.assertEqual(
            self.db.execute("SELECT COUNT(*) FROM space_items").fetchone()[0], 0
        )

    def test_unique_slug_and_visibility_constraints(self):
        self.create_space()
        with self.assertRaises(sqlite3.IntegrityError):
            self.create_space("space-2", "user-2", "alpha")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO spaces (id, owner_id, name, slug, visibility)
                   VALUES ('space-2', 'user-2', 'Beta', 'beta', 'secret')"""
            )

    def test_item_scoped_grant_cannot_cross_space_boundary(self):
        self.create_space()
        self.create_space("space-2", "user-2", "beta")
        self.create_item("item-1", "space-1")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO access_grants
                   (id, space_id, item_id, subject_user_id, permission, granted_by)
                   VALUES ('grant-1', 'space-2', 'item-1', 'user-2', 'view', 'user-2')"""
            )

    def test_item_cannot_be_published_without_valid_storage_state(self):
        self.create_space()
        self.create_item()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO space_assets
                   (id, space_id, item_id, uploader_id, r2_key, original_name,
                    content_type, size_bytes, storage_state, scan_status)
                   VALUES ('asset-1', 'space-1', 'item-1', 'user-1', 'q/1',
                           'file.pdf', 'application/pdf', 100, 'published', 'quarantined')"""
            )

    def test_asset_hash_and_size_constraints(self):
        self.create_space()
        self.create_item()
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO space_assets
                   (id, space_id, item_id, uploader_id, r2_key, original_name,
                    content_type, size_bytes, sha256_hash)
                   VALUES ('asset-1', 'space-1', 'item-1', 'user-1', 'q/1',
                           'file.pdf', 'application/pdf', 100, 'not-a-sha256')"""
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO space_assets
                   (id, space_id, item_id, uploader_id, r2_key, original_name,
                    content_type, size_bytes)
                   VALUES ('asset-2', 'space-1', 'item-1', 'user-1', 'q/2',
                           'file.pdf', 'application/pdf', 52428801)"""
            )

    def test_comment_parent_must_belong_to_same_item_and_not_self(self):
        self.create_space()
        self.create_item()
        self.db.execute(
            """INSERT INTO space_comments
               (id, space_id, item_id, user_id, body)
               VALUES ('comment-1', 'space-1', 'item-1', 'user-1', 'Root')"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO space_comments
                   (id, space_id, item_id, user_id, parent_comment_id, body)
                   VALUES ('comment-2', 'space-1', 'item-1', 'user-1',
                           'comment-2', 'Self reference')"""
            )

    def test_rating_range_and_uniqueness(self):
        self.create_space()
        self.db.execute(
            """INSERT INTO space_ratings (id, space_id, user_id, rating)
               VALUES ('rating-1', 'space-1', 'user-1', 5)"""
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO space_ratings (id, space_id, user_id, rating)
                   VALUES ('rating-2', 'space-1', 'user-1', 4)"""
            )
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(
                """INSERT INTO space_ratings (id, space_id, user_id, rating)
                   VALUES ('rating-3', 'space-1', 'user-2', 6)"""
            )


if __name__ == "__main__":
    unittest.main(verbosity=2)

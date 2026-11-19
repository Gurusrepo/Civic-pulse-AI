export const version = '009_announcements';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS civic_announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
      description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 3000),
      published_by_admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      published_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_civic_announcements_published
      ON civic_announcements(published_at DESC,id DESC);
    CREATE TRIGGER IF NOT EXISTS civic_announcements_require_admin
      BEFORE INSERT ON civic_announcements
      WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.published_by_admin_id AND role='ADMIN')
      BEGIN SELECT RAISE(ABORT,'announcements require ADMIN'); END;
  `);
}

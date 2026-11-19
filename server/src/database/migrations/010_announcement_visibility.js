export const version = '010_announcement_visibility';

export function up(db) {
  const columns = db.prepare('PRAGMA table_info(civic_announcements)').all();
  if (!columns.some((column) => column.name === 'is_published')) {
    db.exec(`ALTER TABLE civic_announcements ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1
      CHECK (is_published IN (0,1))`);
  }
  if (!columns.some((column) => column.name === 'is_public')) {
    db.exec(`ALTER TABLE civic_announcements ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1
      CHECK (is_public IN (0,1))`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_civic_announcements_visibility_published
    ON civic_announcements(is_published,is_public,published_at DESC,id DESC)`);
}

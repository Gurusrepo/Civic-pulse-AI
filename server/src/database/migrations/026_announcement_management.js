export const version = '026_announcement_management';

export function up(db) {
  db.exec(`
    ALTER TABLE civic_announcements
      ADD COLUMN priority TEXT NOT NULL DEFAULT 'NORMAL'
      CHECK (priority IN ('LOW', 'NORMAL', 'HIGH'));

    ALTER TABLE civic_announcements
      ADD COLUMN starts_at TEXT
      CHECK (
        starts_at IS NULL OR (
          substr(starts_at, -1) = 'Z' AND julianday(starts_at) IS NOT NULL
        )
      );

    ALTER TABLE civic_announcements
      ADD COLUMN expires_at TEXT
      CHECK (
        expires_at IS NULL OR (
          substr(expires_at, -1) = 'Z' AND
          julianday(expires_at) IS NOT NULL AND
          (
            starts_at IS NULL OR
            (
              julianday(starts_at) IS NOT NULL AND
              julianday(expires_at) > julianday(starts_at)
            )
          )
        )
      );
  `);
}

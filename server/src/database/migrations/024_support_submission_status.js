export const version = '024_support_submission_status';

export function up(db) {
  const columns = db.prepare('PRAGMA table_info(citizen_support_submissions)').all();
  if (columns.some((column) => column.name === 'status')) return;

  db.exec(`
    ALTER TABLE citizen_support_submissions ADD COLUMN status TEXT NOT NULL DEFAULT 'NEW'
      CHECK (status IN ('NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'));
    ALTER TABLE citizen_support_submissions ADD COLUMN admin_notes TEXT;
    ALTER TABLE citizen_support_submissions ADD COLUMN updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    ALTER TABLE citizen_support_submissions ADD COLUMN closed_at TEXT;

    UPDATE citizen_support_submissions
      SET status = 'NEW', updated_at = created_at
      WHERE status IS NULL OR status = 'NEW';

    CREATE INDEX IF NOT EXISTS idx_citizen_support_kind_status_created
      ON citizen_support_submissions(kind, status, created_at DESC);
  `);
}

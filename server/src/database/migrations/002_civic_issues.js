export const version = '002_civic_issues';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS civic_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'MERGED')),
      merged_into_issue_id INTEGER REFERENCES civic_issues(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      CHECK (merged_into_issue_id IS NULL OR merged_into_issue_id <> id),
      CHECK ((status = 'MERGED') = (merged_into_issue_id IS NOT NULL))
    );
  `);

  const complaintColumns = db.prepare('PRAGMA table_info(complaints)').all();
  if (!complaintColumns.some((column) => column.name === 'civic_issue_id')) {
    db.exec(`ALTER TABLE complaints ADD COLUMN civic_issue_id INTEGER
      REFERENCES civic_issues(id) ON DELETE RESTRICT`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_complaints_civic_issue
    ON complaints(civic_issue_id, created_at DESC, id DESC)`);

  const unlinked = db.prepare(`SELECT id FROM complaints WHERE civic_issue_id IS NULL ORDER BY id`).all();
  const createIssue = db.prepare(`INSERT INTO civic_issues (status) VALUES ('OPEN')`);
  const linkComplaint = db.prepare('UPDATE complaints SET civic_issue_id = ? WHERE id = ? AND civic_issue_id IS NULL');
  for (const complaint of unlinked) {
    const issueId = Number(createIssue.run().lastInsertRowid);
    linkComplaint.run(issueId, complaint.id);
  }
}

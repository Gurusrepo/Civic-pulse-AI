export const version = '004_issue_grouping';

export function up(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_complaints_location_time
      ON complaints(latitude, longitude, created_at DESC, civic_issue_id);
    CREATE TABLE IF NOT EXISTS civic_issue_duplicate_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_a_id INTEGER NOT NULL REFERENCES civic_issues(id) ON DELETE RESTRICT,
      issue_b_id INTEGER NOT NULL REFERENCES civic_issues(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','STALE')),
      deterministic_score REAL NOT NULL CHECK (deterministic_score >= 0 AND deterministic_score <= 1),
      signals_json TEXT NOT NULL,
      ai_result TEXT CHECK (ai_result IS NULL OR ai_result IN ('LIKELY_DUPLICATE','UNCERTAIN','UNLIKELY_DUPLICATE')),
      ai_confidence REAL CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
      ai_rationale TEXT,
      reviewer_admin_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      reviewed_at TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      CHECK (issue_a_id < issue_b_id),
      CHECK ((status IN ('APPROVED','REJECTED') AND reviewer_admin_id IS NOT NULL AND reviewed_at IS NOT NULL)
        OR status IN ('PENDING','STALE'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_duplicate_suggestion_pair
      ON civic_issue_duplicate_suggestions(issue_a_id, issue_b_id);
    CREATE INDEX IF NOT EXISTS idx_duplicate_suggestion_status
      ON civic_issue_duplicate_suggestions(status, created_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS civic_issue_grouping_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      suggestion_id INTEGER NOT NULL UNIQUE REFERENCES civic_issue_duplicate_suggestions(id) ON DELETE RESTRICT,
      source_issue_id INTEGER NOT NULL REFERENCES civic_issues(id) ON DELETE RESTRICT,
      canonical_issue_id INTEGER NOT NULL REFERENCES civic_issues(id) ON DELETE RESTRICT,
      admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      CHECK (source_issue_id <> canonical_issue_id)
    );
    CREATE TRIGGER IF NOT EXISTS grouping_events_valid_admin
      BEFORE INSERT ON civic_issue_grouping_events
      WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.admin_user_id AND role='ADMIN')
      BEGIN SELECT RAISE(ABORT, 'grouping requires ADMIN'); END;
    CREATE TRIGGER IF NOT EXISTS grouping_events_no_update BEFORE UPDATE ON civic_issue_grouping_events
      BEGIN SELECT RAISE(ABORT, 'grouping events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS grouping_events_no_delete BEFORE DELETE ON civic_issue_grouping_events
      BEGIN SELECT RAISE(ABORT, 'grouping events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS civic_issue_no_merge_cycle
      BEFORE UPDATE OF merged_into_issue_id ON civic_issues
      WHEN NEW.merged_into_issue_id IS NOT NULL
      BEGIN
        SELECT CASE WHEN EXISTS (
          WITH RECURSIVE targets(id) AS (
            SELECT NEW.merged_into_issue_id
            UNION
            SELECT i.merged_into_issue_id FROM civic_issues i JOIN targets t ON i.id=t.id
              WHERE i.merged_into_issue_id IS NOT NULL
          ) SELECT 1 FROM targets WHERE id=NEW.id
        ) THEN RAISE(ABORT, 'civic issue merge would create a cycle') END;
      END;
  `);
}

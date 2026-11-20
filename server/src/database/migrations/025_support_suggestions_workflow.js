export const version = '025_support_suggestions_workflow';
export const requiresForeignKeysDisabled = true;

export function up(db) {
  db.exec(`
    CREATE TABLE citizen_support_submissions_next (
      reference_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK (kind IN ('BUG_REPORT','SUGGESTION')),
      title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
      category TEXT NOT NULL,
      description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 5000),
      screenshot_key TEXT,
      screenshot_mime_type TEXT CHECK (screenshot_mime_type IS NULL OR screenshot_mime_type IN ('image/jpeg','image/png','image/webp')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      status TEXT NOT NULL DEFAULT 'NEW' CHECK (
        (kind = 'BUG_REPORT' AND status IN ('NEW', 'IN_PROGRESS', 'RESOLVED', 'REJECTED')) OR
        (kind = 'SUGGESTION' AND status IN ('NEW', 'UNDER_REVIEW', 'PLANNED', 'IMPLEMENTED', 'REJECTED'))
      ),
      admin_notes TEXT,
      rejection_reason TEXT,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      closed_at TEXT,
      CHECK (
        (status <> 'REJECTED' OR kind <> 'SUGGESTION' OR (rejection_reason IS NOT NULL AND length(trim(rejection_reason)) BETWEEN 3 AND 1000))
        AND
        (status = 'REJECTED' OR rejection_reason IS NULL)
      )
    );

    INSERT INTO citizen_support_submissions_next (
      reference_id,
      user_id,
      kind,
      title,
      category,
      description,
      screenshot_key,
      screenshot_mime_type,
      created_at,
      status,
      admin_notes,
      rejection_reason,
      updated_at,
      closed_at
    )
    SELECT
      reference_id,
      user_id,
      kind,
      title,
      category,
      description,
      screenshot_key,
      screenshot_mime_type,
      created_at,
      CASE
        WHEN kind = 'SUGGESTION'
          AND status NOT IN ('NEW', 'UNDER_REVIEW', 'PLANNED', 'IMPLEMENTED')
        THEN 'NEW'
        ELSE status
      END AS status,
      admin_notes,
      NULL AS rejection_reason,
      updated_at,
      CASE
        WHEN kind = 'SUGGESTION'
          AND status NOT IN ('NEW', 'UNDER_REVIEW', 'PLANNED', 'IMPLEMENTED')
        THEN NULL
        ELSE closed_at
      END AS closed_at
    FROM citizen_support_submissions;

    ALTER TABLE citizen_support_submissions RENAME TO citizen_support_submissions_old;
    ALTER TABLE citizen_support_submissions_next RENAME TO citizen_support_submissions;
    DROP TABLE citizen_support_submissions_old;

    CREATE INDEX idx_citizen_support_user_created
      ON citizen_support_submissions(user_id, created_at DESC);
    CREATE INDEX idx_citizen_support_kind_status_created
      ON citizen_support_submissions(kind, status, created_at DESC);
  `);
}

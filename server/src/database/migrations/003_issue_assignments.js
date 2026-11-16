export const version = '003_issue_assignments';

export function up(db) {
  const issueColumns = db.prepare('PRAGMA table_info(civic_issues)').all();
  if (!issueColumns.some((column) => column.name === 'assigned_officer_id')) {
    db.exec(`ALTER TABLE civic_issues ADD COLUMN assigned_officer_id INTEGER
      REFERENCES users(id) ON DELETE RESTRICT`);
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_civic_issues_status_created
      ON civic_issues(status, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_civic_issues_merged_into
      ON civic_issues(merged_into_issue_id);
    CREATE INDEX IF NOT EXISTS idx_civic_issues_assigned_officer
      ON civic_issues(assigned_officer_id, status);

    CREATE TABLE IF NOT EXISTS civic_issue_assignment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      civic_issue_id INTEGER NOT NULL REFERENCES civic_issues(id) ON DELETE RESTRICT,
      event_type TEXT NOT NULL CHECK (event_type IN ('ASSIGNED', 'REASSIGNED', 'UNASSIGNED')),
      previous_officer_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      officer_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      CHECK (
        (event_type = 'ASSIGNED' AND previous_officer_id IS NULL AND officer_id IS NOT NULL) OR
        (event_type = 'REASSIGNED' AND previous_officer_id IS NOT NULL AND officer_id IS NOT NULL
          AND previous_officer_id <> officer_id) OR
        (event_type = 'UNASSIGNED' AND previous_officer_id IS NOT NULL AND officer_id IS NULL)
      )
    );
    CREATE INDEX IF NOT EXISTS idx_issue_assignment_events_issue
      ON civic_issue_assignment_events(civic_issue_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_issue_assignment_events_officer
      ON civic_issue_assignment_events(officer_id, created_at DESC, id DESC);

    CREATE TRIGGER IF NOT EXISTS civic_issue_assignment_events_no_update
      BEFORE UPDATE ON civic_issue_assignment_events
      BEGIN SELECT RAISE(ABORT, 'assignment events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS civic_issue_assignment_events_no_delete
      BEFORE DELETE ON civic_issue_assignment_events
      BEGIN SELECT RAISE(ABORT, 'assignment events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS civic_issue_assignment_events_valid_roles
      BEFORE INSERT ON civic_issue_assignment_events
      WHEN NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.admin_user_id AND role = 'ADMIN')
        OR (NEW.previous_officer_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM users WHERE id = NEW.previous_officer_id AND role = 'OFFICER'
        ))
        OR (NEW.officer_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM users WHERE id = NEW.officer_id AND role = 'OFFICER'
        ))
        OR EXISTS (SELECT 1 FROM civic_issues WHERE id = NEW.civic_issue_id AND status = 'MERGED')
        OR (NEW.event_type IN ('ASSIGNED', 'REASSIGNED') AND NOT EXISTS (
          SELECT 1 FROM civic_issues WHERE id = NEW.civic_issue_id AND assigned_officer_id = NEW.officer_id
        ))
        OR (NEW.event_type = 'UNASSIGNED' AND EXISTS (
          SELECT 1 FROM civic_issues WHERE id = NEW.civic_issue_id AND assigned_officer_id IS NOT NULL
        ))
      BEGIN SELECT RAISE(ABORT, 'invalid civic issue assignment event'); END;
    CREATE TRIGGER IF NOT EXISTS civic_issue_assignment_valid_officer
      BEFORE UPDATE OF assigned_officer_id ON civic_issues
      WHEN NEW.assigned_officer_id IS NOT NULL AND (
        NEW.status = 'MERGED' OR NEW.merged_into_issue_id IS NOT NULL OR
        NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.assigned_officer_id AND role = 'OFFICER')
      )
      BEGIN SELECT RAISE(ABORT, 'assignment requires an active issue and OFFICER user'); END;
    CREATE TRIGGER IF NOT EXISTS civic_issue_no_assignment_when_merged
      BEFORE UPDATE OF status ON civic_issues
      WHEN NEW.status = 'MERGED' AND NEW.assigned_officer_id IS NOT NULL
      BEGIN SELECT RAISE(ABORT, 'unassign issue before merging'); END;
    CREATE TRIGGER IF NOT EXISTS assigned_officer_role_cannot_be_changed
      BEFORE UPDATE OF role ON users
      WHEN OLD.role = 'OFFICER' AND NEW.role <> 'OFFICER' AND EXISTS (
        SELECT 1 FROM civic_issues WHERE assigned_officer_id = OLD.id
      )
      BEGIN SELECT RAISE(ABORT, 'unassign officer before changing role'); END;
  `);
}

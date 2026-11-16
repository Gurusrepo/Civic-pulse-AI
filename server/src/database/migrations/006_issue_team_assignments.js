export const version = '006_issue_team_assignments';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS civic_issue_team_assignment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      civic_issue_id INTEGER NOT NULL REFERENCES civic_issues(id) ON DELETE RESTRICT,
      event_type TEXT NOT NULL CHECK (event_type IN ('ASSIGNED','REASSIGNED','UNASSIGNED')),
      previous_team_id INTEGER REFERENCES ward_teams(id) ON DELETE RESTRICT,
      team_id INTEGER REFERENCES ward_teams(id) ON DELETE RESTRICT,
      approved_department TEXT NOT NULL CHECK (approved_department IN (
        'Roads & Infrastructure', 'Water Supply', 'Drainage', 'Sanitation',
        'Electricity', 'Public Health', 'Public Works', 'General Administration'
      )),
      admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      CHECK (
        (event_type='ASSIGNED' AND previous_team_id IS NULL AND team_id IS NOT NULL) OR
        (event_type='REASSIGNED' AND previous_team_id IS NOT NULL AND team_id IS NOT NULL AND previous_team_id<>team_id) OR
        (event_type='UNASSIGNED' AND previous_team_id IS NOT NULL AND team_id IS NULL)
      )
    );
    CREATE INDEX IF NOT EXISTS idx_team_assignment_events_issue
      ON civic_issue_team_assignment_events(civic_issue_id,created_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS idx_team_assignment_events_team
      ON civic_issue_team_assignment_events(team_id,created_at DESC,id DESC);
  `);

  const issueColumns = db.prepare('PRAGMA table_info(civic_issues)').all();
  if (!issueColumns.some(column => column.name === 'assigned_team_id')) {
    db.exec('ALTER TABLE civic_issues ADD COLUMN assigned_team_id INTEGER REFERENCES ward_teams(id) ON DELETE RESTRICT');
  }
  if (!issueColumns.some(column => column.name === 'routing_department')) {
    db.exec('ALTER TABLE civic_issues ADD COLUMN routing_department TEXT');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_civic_issues_assigned_team
      ON civic_issues(assigned_team_id,status);

    CREATE TRIGGER IF NOT EXISTS civic_issue_team_assignment_valid
      BEFORE UPDATE OF assigned_team_id,routing_department ON civic_issues
      WHEN (NEW.assigned_team_id IS NULL) <> (NEW.routing_department IS NULL)
        OR (NEW.assigned_team_id IS NOT NULL AND (
          NEW.status='MERGED' OR NEW.merged_into_issue_id IS NOT NULL OR NEW.assigned_officer_id IS NOT NULL
          OR NOT EXISTS (
            SELECT 1 FROM ward_teams t JOIN wards w ON w.id=t.ward_id
            WHERE t.id=NEW.assigned_team_id AND t.is_active=1 AND w.is_active=1
              AND t.department=NEW.routing_department
          )
          OR NOT EXISTS (
            SELECT 1 FROM ward_team_memberships m JOIN users u ON u.id=m.officer_user_id
            WHERE m.team_id=NEW.assigned_team_id AND m.removed_at IS NULL AND u.role='OFFICER'
          )
        ))
      BEGIN SELECT RAISE(ABORT,'invalid ward team issue assignment'); END;

    CREATE TRIGGER IF NOT EXISTS civic_issue_individual_assignment_deprecated
      BEFORE UPDATE OF assigned_officer_id ON civic_issues
      WHEN NEW.assigned_officer_id IS NOT NULL AND NEW.assigned_officer_id IS NOT OLD.assigned_officer_id
      BEGIN SELECT RAISE(ABORT,'new individual assignments are disabled; route to a ward team'); END;

    CREATE TRIGGER IF NOT EXISTS civic_issue_no_team_assignment_when_merged
      BEFORE UPDATE OF status ON civic_issues
      WHEN NEW.status='MERGED' AND NEW.assigned_team_id IS NOT NULL
      BEGIN SELECT RAISE(ABORT,'unassign the ward team before merging'); END;

    CREATE TRIGGER IF NOT EXISTS team_assignment_events_valid
      BEFORE INSERT ON civic_issue_team_assignment_events
      WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.admin_user_id AND role='ADMIN')
        OR (NEW.event_type IN ('ASSIGNED','REASSIGNED') AND (
          NOT EXISTS (SELECT 1 FROM civic_issues WHERE id=NEW.civic_issue_id
            AND assigned_team_id=NEW.team_id AND routing_department=NEW.approved_department AND status<>'MERGED')
          OR NOT EXISTS (SELECT 1 FROM ward_teams t JOIN wards w ON w.id=t.ward_id
            WHERE t.id=NEW.team_id AND t.is_active=1 AND w.is_active=1 AND t.department=NEW.approved_department)
        ))
        OR (NEW.event_type='UNASSIGNED' AND NOT EXISTS (
          SELECT 1 FROM civic_issues WHERE id=NEW.civic_issue_id AND assigned_team_id IS NULL AND routing_department IS NULL
        ))
      BEGIN SELECT RAISE(ABORT,'invalid civic issue team assignment event'); END;
    CREATE TRIGGER IF NOT EXISTS team_assignment_events_no_update
      BEFORE UPDATE ON civic_issue_team_assignment_events
      BEGIN SELECT RAISE(ABORT,'team assignment events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS team_assignment_events_no_delete
      BEFORE DELETE ON civic_issue_team_assignment_events
      BEGIN SELECT RAISE(ABORT,'team assignment events are append-only'); END;

    CREATE TRIGGER IF NOT EXISTS ward_team_active_while_assigned
      BEFORE UPDATE OF is_active ON ward_teams
      WHEN NEW.is_active=0 AND EXISTS (
        SELECT 1 FROM civic_issues WHERE assigned_team_id=OLD.id
      )
      BEGIN SELECT RAISE(ABORT,'unassign issues before deactivating team'); END;
    CREATE TRIGGER IF NOT EXISTS ward_team_department_guard
      BEFORE UPDATE OF department ON ward_teams
      WHEN NEW.department<>OLD.department AND EXISTS (
        SELECT 1 FROM civic_issues WHERE assigned_team_id=OLD.id
      )
      BEGIN SELECT RAISE(ABORT,'unassign issues before changing team department'); END;
    CREATE TRIGGER IF NOT EXISTS ward_team_move_guard
      BEFORE UPDATE OF ward_id ON ward_teams
      WHEN NEW.ward_id<>OLD.ward_id AND EXISTS (
        SELECT 1 FROM civic_issues WHERE assigned_team_id=OLD.id
      )
      BEGIN SELECT RAISE(ABORT,'unassign issues before moving team to another ward'); END;
    CREATE TRIGGER IF NOT EXISTS ward_active_while_teams_assigned
      BEFORE UPDATE OF is_active ON wards
      WHEN NEW.is_active=0 AND EXISTS (
        SELECT 1 FROM civic_issues i JOIN ward_teams t ON t.id=i.assigned_team_id WHERE t.ward_id=OLD.id
      )
      BEGIN SELECT RAISE(ABORT,'unassign issues before deactivating ward'); END;
    CREATE TRIGGER IF NOT EXISTS team_membership_last_member_guard
      BEFORE UPDATE OF removed_at ON ward_team_memberships
      WHEN OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL
        AND EXISTS (SELECT 1 FROM civic_issues WHERE assigned_team_id=OLD.team_id)
        AND (SELECT COUNT(*) FROM ward_team_memberships WHERE team_id=OLD.team_id AND removed_at IS NULL)<=1
      BEGIN SELECT RAISE(ABORT,'cannot remove last member while team has assigned issues'); END;
  `);
}

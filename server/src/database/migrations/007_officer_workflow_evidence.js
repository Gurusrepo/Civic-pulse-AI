export const version = '007_officer_workflow_evidence';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS civic_issue_work_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      civic_issue_id INTEGER NOT NULL REFERENCES civic_issues(id) ON DELETE RESTRICT,
      event_type TEXT NOT NULL CHECK (event_type IN ('STARTED','EVIDENCE_UPLOADED','COMPLETED')),
      team_id INTEGER NOT NULL REFERENCES ward_teams(id) ON DELETE RESTRICT,
      assignment_event_id INTEGER NOT NULL REFERENCES civic_issue_team_assignment_events(id) ON DELETE RESTRICT,
      officer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      evidence_id INTEGER REFERENCES civic_issue_repair_evidence(id) ON DELETE RESTRICT,
      status_before TEXT NOT NULL CHECK (status_before IN ('OPEN','IN_PROGRESS')),
      status_after TEXT NOT NULL CHECK (status_after IN ('OPEN','IN_PROGRESS','RESOLVED')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      CHECK ((event_type='STARTED' AND evidence_id IS NULL AND status_before='OPEN' AND status_after='IN_PROGRESS') OR
        (event_type='EVIDENCE_UPLOADED' AND evidence_id IS NOT NULL AND status_before=status_after) OR
        (event_type='COMPLETED' AND evidence_id IS NULL AND status_before='IN_PROGRESS' AND status_after='RESOLVED'))
    );

    CREATE TABLE IF NOT EXISTS civic_issue_repair_evidence (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      civic_issue_id INTEGER NOT NULL REFERENCES civic_issues(id) ON DELETE RESTRICT,
      team_id INTEGER NOT NULL REFERENCES ward_teams(id) ON DELETE RESTRICT,
      assignment_event_id INTEGER NOT NULL REFERENCES civic_issue_team_assignment_events(id) ON DELETE RESTRICT,
      uploaded_by_officer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      stage TEXT NOT NULL CHECK (stage IN ('BEFORE','AFTER')),
      object_key TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp')),
      byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE INDEX IF NOT EXISTS idx_repair_evidence_issue_stage
      ON civic_issue_repair_evidence(civic_issue_id,stage,created_at,id);
    CREATE INDEX IF NOT EXISTS idx_issue_work_events_issue
      ON civic_issue_work_events(civic_issue_id,created_at,id);
    CREATE INDEX IF NOT EXISTS idx_issue_work_events_team
      ON civic_issue_work_events(team_id,created_at,id);
    CREATE INDEX IF NOT EXISTS idx_issue_work_events_officer
      ON civic_issue_work_events(officer_user_id,created_at,id);

    CREATE TRIGGER IF NOT EXISTS repair_evidence_requires_current_assignment
      BEFORE INSERT ON civic_issue_repair_evidence
      WHEN NOT EXISTS (
        SELECT 1 FROM civic_issues i
        JOIN civic_issue_team_assignment_events e ON e.id=NEW.assignment_event_id
        JOIN ward_teams t ON t.id=NEW.team_id
        JOIN wards w ON w.id=t.ward_id
        JOIN ward_team_memberships m ON m.team_id=t.id AND m.officer_user_id=NEW.uploaded_by_officer_id AND m.removed_at IS NULL
        JOIN users u ON u.id=NEW.uploaded_by_officer_id AND u.role='OFFICER'
        WHERE i.id=NEW.civic_issue_id AND i.assigned_team_id=NEW.team_id
          AND i.status IN ('OPEN','IN_PROGRESS') AND i.merged_into_issue_id IS NULL
          AND t.is_active=1 AND w.is_active=1
          AND e.civic_issue_id=i.id AND e.team_id=t.id AND e.event_type IN ('ASSIGNED','REASSIGNED')
          AND e.id=(SELECT latest.id FROM civic_issue_team_assignment_events latest
            WHERE latest.civic_issue_id=i.id ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1)
          AND ((NEW.stage='BEFORE' AND i.status IN ('OPEN','IN_PROGRESS')) OR
            (NEW.stage='AFTER' AND i.status='IN_PROGRESS'))
      )
      BEGIN SELECT RAISE(ABORT,'repair evidence requires an authorized current team assignment'); END;

    CREATE TRIGGER IF NOT EXISTS repair_evidence_no_update BEFORE UPDATE ON civic_issue_repair_evidence
      BEGIN SELECT RAISE(ABORT,'repair evidence is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS repair_evidence_no_delete BEFORE DELETE ON civic_issue_repair_evidence
      BEGIN SELECT RAISE(ABORT,'repair evidence is append-only'); END;

    CREATE TRIGGER IF NOT EXISTS issue_work_events_valid
      BEFORE INSERT ON civic_issue_work_events
      WHEN NOT EXISTS (
        SELECT 1 FROM civic_issues i
        JOIN civic_issue_team_assignment_events a ON a.id=NEW.assignment_event_id
        JOIN ward_team_memberships m ON m.team_id=NEW.team_id AND m.officer_user_id=NEW.officer_user_id AND m.removed_at IS NULL
        JOIN users u ON u.id=NEW.officer_user_id AND u.role='OFFICER'
        WHERE i.id=NEW.civic_issue_id AND i.assigned_team_id=NEW.team_id AND i.status=NEW.status_after
          AND i.merged_into_issue_id IS NULL AND a.civic_issue_id=i.id AND a.team_id=i.assigned_team_id
          AND a.event_type IN ('ASSIGNED','REASSIGNED')
          AND a.id=(SELECT latest.id FROM civic_issue_team_assignment_events latest
            WHERE latest.civic_issue_id=i.id ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1)
          AND ((NEW.event_type='STARTED' AND NEW.status_before='OPEN' AND NEW.status_after='IN_PROGRESS') OR
            (NEW.event_type='COMPLETED' AND NEW.status_before='IN_PROGRESS' AND NEW.status_after='RESOLVED') OR
            (NEW.event_type='EVIDENCE_UPLOADED' AND NEW.status_before=NEW.status_after AND
              EXISTS (SELECT 1 FROM civic_issue_repair_evidence r WHERE r.id=NEW.evidence_id
                AND r.civic_issue_id=i.id AND r.team_id=i.assigned_team_id
                AND r.assignment_event_id=a.id AND r.uploaded_by_officer_id=NEW.officer_user_id)))
      )
      BEGIN SELECT RAISE(ABORT,'invalid civic issue work event'); END;
    CREATE TRIGGER IF NOT EXISTS issue_work_events_no_update BEFORE UPDATE ON civic_issue_work_events
      BEGIN SELECT RAISE(ABORT,'work events are append-only'); END;
    CREATE TRIGGER IF NOT EXISTS issue_work_events_no_delete BEFORE DELETE ON civic_issue_work_events
      BEGIN SELECT RAISE(ABORT,'work events are append-only'); END;

    CREATE TRIGGER IF NOT EXISTS team_assignment_locked_during_work
      BEFORE UPDATE OF assigned_team_id,routing_department ON civic_issues
      WHEN OLD.status='IN_PROGRESS' AND
        (NEW.assigned_team_id IS NOT OLD.assigned_team_id OR NEW.routing_department IS NOT OLD.routing_department)
      BEGIN SELECT RAISE(ABORT,'team assignment cannot change while work is in progress'); END;
  `);
}

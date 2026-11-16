export const version = '008_citizen_resolution_verification';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS civic_issue_resolution_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      civic_issue_id INTEGER NOT NULL REFERENCES civic_issues(id) ON DELETE RESTRICT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE RESTRICT,
      citizen_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      decision TEXT NOT NULL CHECK (decision IN ('CONFIRM','DISPUTE')),
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE(civic_issue_id,citizen_user_id),
      CHECK ((decision='CONFIRM' AND reason IS NULL) OR
        (decision='DISPUTE' AND reason IS NOT NULL AND length(trim(reason)) BETWEEN 1 AND 2000))
    );
    CREATE INDEX IF NOT EXISTS idx_resolution_verifications_issue_decision
      ON civic_issue_resolution_verifications(civic_issue_id,decision,created_at,id);
    CREATE INDEX IF NOT EXISTS idx_resolution_verifications_citizen
      ON civic_issue_resolution_verifications(citizen_user_id,civic_issue_id);

    CREATE TABLE IF NOT EXISTS civic_issue_dispute_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      civic_issue_id INTEGER NOT NULL UNIQUE REFERENCES civic_issues(id) ON DELETE RESTRICT,
      decision TEXT NOT NULL CHECK (decision IN ('ACCEPTED','REJECTED')),
      reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
      admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      previous_team_id INTEGER REFERENCES ward_teams(id) ON DELETE RESTRICT,
      previous_officer_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      unassigned_team_event_id INTEGER REFERENCES civic_issue_team_assignment_events(id) ON DELETE RESTRICT,
      unassigned_officer_event_id INTEGER REFERENCES civic_issue_assignment_events(id) ON DELETE RESTRICT,
      status_before TEXT NOT NULL CHECK (status_before='RESOLVED'),
      status_after TEXT NOT NULL CHECK (status_after IN ('OPEN','RESOLVED')),
      reviewed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      CHECK ((decision='ACCEPTED' AND status_after='OPEN') OR
        (decision='REJECTED' AND status_after='RESOLVED' AND unassigned_team_event_id IS NULL
          AND unassigned_officer_event_id IS NULL)),
      CHECK (unassigned_team_event_id IS NULL OR unassigned_officer_event_id IS NULL)
    );
    CREATE INDEX IF NOT EXISTS idx_dispute_reviews_admin_time
      ON civic_issue_dispute_reviews(admin_user_id,reviewed_at DESC,id DESC);

    CREATE TRIGGER IF NOT EXISTS resolution_verification_valid
      BEFORE INSERT ON civic_issue_resolution_verifications
      WHEN NOT EXISTS (
        SELECT 1 FROM complaints c JOIN civic_issues i ON i.id=c.civic_issue_id
        JOIN users u ON u.id=c.user_id
        WHERE c.id=NEW.complaint_id AND c.user_id=NEW.citizen_user_id
          AND c.civic_issue_id=NEW.civic_issue_id AND u.role='CITIZEN'
          AND i.status='RESOLVED' AND i.merged_into_issue_id IS NULL
      ) OR EXISTS (SELECT 1 FROM civic_issue_dispute_reviews r WHERE r.civic_issue_id=NEW.civic_issue_id)
      BEGIN SELECT RAISE(ABORT,'verification requires an owned complaint on an unreviewed resolved issue'); END;
    CREATE TRIGGER IF NOT EXISTS resolution_verifications_no_update BEFORE UPDATE ON civic_issue_resolution_verifications
      BEGIN SELECT RAISE(ABORT,'citizen verifications are immutable'); END;
    CREATE TRIGGER IF NOT EXISTS resolution_verifications_no_delete BEFORE DELETE ON civic_issue_resolution_verifications
      BEGIN SELECT RAISE(ABORT,'citizen verification history cannot be deleted'); END;

    CREATE TRIGGER IF NOT EXISTS dispute_review_valid
      BEFORE INSERT ON civic_issue_dispute_reviews
      WHEN NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.admin_user_id AND role='ADMIN')
        OR NOT EXISTS (SELECT 1 FROM civic_issue_resolution_verifications v
          WHERE v.civic_issue_id=NEW.civic_issue_id AND v.decision='DISPUTE')
        OR NOT EXISTS (SELECT 1 FROM civic_issues i WHERE i.id=NEW.civic_issue_id
          AND i.status=NEW.status_after AND i.merged_into_issue_id IS NULL
          AND ((NEW.decision='ACCEPTED' AND NEW.status_after='OPEN'
                AND i.assigned_team_id IS NULL AND i.routing_department IS NULL AND i.assigned_officer_id IS NULL
                AND ((NEW.previous_team_id IS NULL AND NEW.unassigned_team_event_id IS NULL) OR EXISTS (
                  SELECT 1 FROM civic_issue_team_assignment_events e WHERE e.id=NEW.unassigned_team_event_id
                    AND e.civic_issue_id=i.id AND e.event_type='UNASSIGNED'
                    AND e.previous_team_id=NEW.previous_team_id AND e.team_id IS NULL
                    AND e.admin_user_id=NEW.admin_user_id))
                AND ((NEW.previous_officer_id IS NULL AND NEW.unassigned_officer_event_id IS NULL) OR EXISTS (
                  SELECT 1 FROM civic_issue_assignment_events e WHERE e.id=NEW.unassigned_officer_event_id
                    AND e.civic_issue_id=i.id AND e.event_type='UNASSIGNED'
                    AND e.previous_officer_id=NEW.previous_officer_id AND e.officer_id IS NULL
                    AND e.admin_user_id=NEW.admin_user_id)))
            OR (NEW.decision='REJECTED' AND NEW.status_after='RESOLVED'
                AND i.assigned_team_id IS NEW.previous_team_id
                AND i.assigned_officer_id IS NEW.previous_officer_id)))
      BEGIN SELECT RAISE(ABORT,'invalid admin dispute review'); END;
    CREATE TRIGGER IF NOT EXISTS dispute_reviews_no_update BEFORE UPDATE ON civic_issue_dispute_reviews
      BEGIN SELECT RAISE(ABORT,'dispute reviews are final and immutable'); END;
    CREATE TRIGGER IF NOT EXISTS dispute_reviews_no_delete BEFORE DELETE ON civic_issue_dispute_reviews
      BEGIN SELECT RAISE(ABORT,'dispute review history cannot be deleted'); END;
  `);
}

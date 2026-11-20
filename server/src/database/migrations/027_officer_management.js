export const version = '027_officer_management';

export function up(db) {
  const columns = db.prepare('PRAGMA table_info(users)').all();
  if (!columns.some((column) => column.name === 'employee_id')) {
    db.exec(`ALTER TABLE users ADD COLUMN employee_id TEXT
      CHECK (employee_id IS NULL OR length(trim(employee_id)) BETWEEN 1 AND 64)`);
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id
      ON users(employee_id COLLATE NOCASE) WHERE employee_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS officer_account_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      officer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      admin_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      event_type TEXT NOT NULL CHECK (event_type IN (
        'CREATED','INVITATION_RESENT','ACTIVATED','DEACTIVATED'
      )),
      previous_status TEXT CHECK (previous_status IS NULL OR previous_status IN (
        'ACTIVE','PENDING_EMAIL_VERIFICATION','DEACTIVATED'
      )),
      next_status TEXT NOT NULL CHECK (next_status IN (
        'ACTIVE','PENDING_EMAIL_VERIFICATION','DEACTIVATED'
      )),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_officer_account_events_officer
      ON officer_account_events(officer_user_id,created_at,id);

    CREATE TRIGGER IF NOT EXISTS officer_employee_id_requires_officer_insert
      BEFORE INSERT ON users
      WHEN NEW.employee_id IS NOT NULL AND NEW.role<>'OFFICER'
      BEGIN SELECT RAISE(ABORT,'employee ID is only valid for OFFICER accounts'); END;
    CREATE TRIGGER IF NOT EXISTS officer_employee_id_requires_officer_update
      BEFORE UPDATE OF employee_id,role ON users
      WHEN NEW.employee_id IS NOT NULL AND NEW.role<>'OFFICER'
      BEGIN SELECT RAISE(ABORT,'employee ID is only valid for OFFICER accounts'); END;

    CREATE TRIGGER IF NOT EXISTS officer_membership_rejects_deactivated
      BEFORE INSERT ON ward_team_memberships
      WHEN NOT EXISTS (
        SELECT 1 FROM users WHERE id=NEW.officer_user_id
          AND role='OFFICER' AND account_status<>'DEACTIVATED'
      )
      BEGIN SELECT RAISE(ABORT,'membership requires a non-deactivated OFFICER'); END;

    CREATE TRIGGER IF NOT EXISTS officer_account_events_no_update
      BEFORE UPDATE ON officer_account_events
      BEGIN SELECT RAISE(ABORT,'officer account history is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS officer_account_events_no_delete
      BEFORE DELETE ON officer_account_events
      BEGIN SELECT RAISE(ABORT,'officer account history is append-only'); END;
  `);
}

export const version = '005_ward_team_management';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(code) BETWEEN 1 AND 32),
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS ward_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ward_id INTEGER NOT NULL REFERENCES wards(id) ON DELETE RESTRICT,
      name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
      department TEXT NOT NULL CHECK (department IN (
        'Roads & Infrastructure', 'Water Supply', 'Drainage', 'Sanitation',
        'Electricity', 'Public Health', 'Public Works', 'General Administration'
      )),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (ward_id, name COLLATE NOCASE)
    );
    CREATE INDEX IF NOT EXISTS idx_ward_teams_ward_active
      ON ward_teams(ward_id, is_active, department);

    CREATE TABLE IF NOT EXISTS ward_team_memberships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL REFERENCES ward_teams(id) ON DELETE RESTRICT,
      officer_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      added_by_admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      removed_by_admin_id INTEGER REFERENCES users(id) ON DELETE RESTRICT,
      removed_at TEXT,
      CHECK ((removed_by_admin_id IS NULL) = (removed_at IS NULL))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_ward_team_memberships_active_pair
      ON ward_team_memberships(team_id, officer_user_id) WHERE removed_at IS NULL;
    CREATE INDEX IF NOT EXISTS idx_ward_team_memberships_officer
      ON ward_team_memberships(officer_user_id, removed_at, team_id);
    CREATE INDEX IF NOT EXISTS idx_ward_team_memberships_team
      ON ward_team_memberships(team_id, removed_at, added_at);

    CREATE TRIGGER IF NOT EXISTS ward_team_requires_active_ward_on_insert
      BEFORE INSERT ON ward_teams WHEN NEW.is_active = 1
        AND NOT EXISTS (SELECT 1 FROM wards WHERE id = NEW.ward_id AND is_active = 1)
      BEGIN SELECT RAISE(ABORT, 'active team requires an active ward'); END;
    CREATE TRIGGER IF NOT EXISTS ward_team_requires_active_ward_on_update
      BEFORE UPDATE OF ward_id, is_active ON ward_teams WHEN NEW.is_active = 1
        AND NOT EXISTS (SELECT 1 FROM wards WHERE id = NEW.ward_id AND is_active = 1)
      BEGIN SELECT RAISE(ABORT, 'active team requires an active ward'); END;
    CREATE TRIGGER IF NOT EXISTS ward_cannot_deactivate_with_active_teams
      BEFORE UPDATE OF is_active ON wards WHEN NEW.is_active = 0
        AND EXISTS (SELECT 1 FROM ward_teams WHERE ward_id = OLD.id AND is_active = 1)
      BEGIN SELECT RAISE(ABORT, 'deactivate ward teams first'); END;
    CREATE TRIGGER IF NOT EXISTS ward_team_cannot_deactivate_with_active_members
      BEFORE UPDATE OF is_active ON ward_teams WHEN NEW.is_active = 0 AND OLD.is_active = 1
        AND EXISTS (SELECT 1 FROM ward_team_memberships WHERE team_id = OLD.id AND removed_at IS NULL)
      BEGIN SELECT RAISE(ABORT, 'remove active team members first'); END;
    CREATE TRIGGER IF NOT EXISTS ward_team_membership_requires_valid_roster
      BEFORE INSERT ON ward_team_memberships
      WHEN NOT EXISTS (
        SELECT 1 FROM ward_teams t JOIN wards w ON w.id = t.ward_id
        WHERE t.id = NEW.team_id AND t.is_active = 1 AND w.is_active = 1
      ) OR NOT EXISTS (
        SELECT 1 FROM users WHERE id = NEW.officer_user_id AND role = 'OFFICER'
      ) OR NOT EXISTS (
        SELECT 1 FROM users WHERE id = NEW.added_by_admin_id AND role = 'ADMIN'
      )
      BEGIN SELECT RAISE(ABORT, 'membership requires active ward, team, OFFICER and ADMIN'); END;
    CREATE TRIGGER IF NOT EXISTS ward_team_membership_removed_by_admin
      BEFORE UPDATE OF removed_at, removed_by_admin_id ON ward_team_memberships
      WHEN OLD.removed_at IS NOT NULL OR NEW.removed_at IS NULL OR NOT EXISTS (
        SELECT 1 FROM users WHERE id = NEW.removed_by_admin_id AND role = 'ADMIN'
      )
      BEGIN SELECT RAISE(ABORT, 'membership removal requires ADMIN and is final'); END;
    CREATE TRIGGER IF NOT EXISTS ward_team_memberships_no_delete
      BEFORE DELETE ON ward_team_memberships
      BEGIN SELECT RAISE(ABORT, 'membership history cannot be deleted'); END;
    CREATE TRIGGER IF NOT EXISTS officer_membership_requires_officer_role
      BEFORE UPDATE OF role ON users WHEN OLD.role = 'OFFICER' AND NEW.role <> 'OFFICER'
        AND EXISTS (SELECT 1 FROM ward_team_memberships WHERE officer_user_id = OLD.id AND removed_at IS NULL)
      BEGIN SELECT RAISE(ABORT, 'remove officer from active teams before role change'); END;
  `);
}

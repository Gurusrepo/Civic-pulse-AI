export const version = '021_email_only_verification';
export const requiresForeignKeysDisabled = true;

export function up(db) {
  const phoneIndexExists = Boolean(db.prepare(`SELECT 1 FROM sqlite_master
    WHERE type='index' AND name='idx_users_phone_number'`).get());
  const userSequence = db.prepare("SELECT seq FROM sqlite_sequence WHERE name='users'").get()?.seq ?? 0;

  db.exec(`
    CREATE TABLE users_next (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
      email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'CITIZEN' CHECK (role IN ('CITIZEN', 'OFFICER', 'ADMIN')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      profile_image_key TEXT,
      profile_image_mime_type TEXT
        CHECK (profile_image_mime_type IS NULL OR profile_image_mime_type IN ('image/jpeg','image/png','image/webp')),
      language TEXT NOT NULL DEFAULT 'en' CHECK (language IN ('en','ta')),
      appearance TEXT NOT NULL DEFAULT 'system' CHECK (appearance IN ('light','dark','system')),
      notification_preferences TEXT NOT NULL DEFAULT '{"inApp":true,"email":true,"sms":true}',
      accessibility_preferences TEXT NOT NULL DEFAULT '{"fontSize":"medium","highContrast":false,"reducedMotion":false}',
      phone_number TEXT,
      date_of_birth TEXT,
      date_of_birth_verification_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED'
        CHECK (date_of_birth_verification_status IN ('NOT_VERIFIED','PENDING','VERIFIED','REJECTED')),
      address TEXT,
      session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0),
      email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0,1)),
      citizen_identity_verification_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED'
        CHECK (citizen_identity_verification_status IN ('NOT_CONFIGURED','PENDING','VERIFIED','REJECTED')),
      account_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE','PENDING_EMAIL_VERIFICATION','DEACTIVATED')),
      deactivated_at TEXT,
      email_verified_at TEXT
    );

    INSERT INTO users_next (
      id,display_name,email,password_hash,role,created_at,updated_at,profile_image_key,
      profile_image_mime_type,language,appearance,notification_preferences,accessibility_preferences,
      phone_number,date_of_birth,date_of_birth_verification_status,address,session_version,
      email_verified,citizen_identity_verification_status,account_status,deactivated_at,email_verified_at
    )
    SELECT
      id,display_name,email,password_hash,role,created_at,updated_at,profile_image_key,
      profile_image_mime_type,language,appearance,notification_preferences,accessibility_preferences,
      phone_number,date_of_birth,date_of_birth_verification_status,address,session_version,
      email_verified,citizen_identity_verification_status,
      CASE WHEN account_status='PENDING_MOBILE_VERIFICATION'
        THEN CASE WHEN email_verified=1 THEN 'ACTIVE' ELSE 'PENDING_EMAIL_VERIFICATION' END
        ELSE account_status END,
      deactivated_at,email_verified_at
    FROM users;

    ALTER TABLE users RENAME TO users_old;
    ALTER TABLE users_next RENAME TO users;
    DROP TABLE users_old;

    CREATE INDEX idx_users_role ON users(role);
    CREATE INDEX idx_users_email ON users(email);

    CREATE TABLE user_verification_challenges_next (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel='EMAIL'),
      purpose TEXT NOT NULL CHECK (purpose IN ('REGISTRATION','LOGIN','PASSWORD_RESET','PROFILE_VERIFICATION')),
      destination TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      resend_after TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      consumed_at TEXT,
      PRIMARY KEY (user_id, channel, purpose)
    );

    INSERT INTO user_verification_challenges_next
      (user_id,channel,purpose,destination,code_hash,expires_at,resend_after,attempt_count,consumed_at)
    SELECT user_id,channel,purpose,destination,code_hash,expires_at,resend_after,attempt_count,consumed_at
    FROM user_verification_challenges
    WHERE channel='EMAIL';

    DROP TABLE user_verification_challenges;
    ALTER TABLE user_verification_challenges_next RENAME TO user_verification_challenges;

    CREATE TRIGGER officer_membership_requires_officer_role
      BEFORE UPDATE OF role ON users WHEN OLD.role = 'OFFICER' AND NEW.role <> 'OFFICER'
        AND EXISTS (SELECT 1 FROM ward_team_memberships WHERE officer_user_id = OLD.id AND removed_at IS NULL)
      BEGIN SELECT RAISE(ABORT, 'remove officer from active teams before role change'); END;

    CREATE TRIGGER assigned_officer_role_cannot_be_changed
      BEFORE UPDATE OF role ON users
      WHEN OLD.role = 'OFFICER' AND NEW.role <> 'OFFICER'
        AND EXISTS (SELECT 1 FROM civic_issues WHERE assigned_officer_id = OLD.id)
      BEGIN SELECT RAISE(ABORT, 'unassign officer before changing role'); END;
  `);

  if (phoneIndexExists) {
    db.exec(`CREATE UNIQUE INDEX idx_users_phone_number
      ON users(phone_number) WHERE phone_number IS NOT NULL`);
  }
  if (userSequence > 0) {
    db.prepare("UPDATE sqlite_sequence SET seq=MAX(seq, ?) WHERE name='users'").run(userSequence);
  }
}

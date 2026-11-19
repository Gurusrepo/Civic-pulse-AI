export const version = '015_citizen_verification';

export function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0
      CHECK (email_verified IN (0,1));
    ALTER TABLE users ADD COLUMN mobile_verified INTEGER NOT NULL DEFAULT 0
      CHECK (mobile_verified IN (0,1));
    ALTER TABLE users ADD COLUMN citizen_identity_verification_status TEXT NOT NULL DEFAULT 'NOT_CONFIGURED'
      CHECK (citizen_identity_verification_status IN ('NOT_CONFIGURED','PENDING','VERIFIED','REJECTED'));

    CREATE TABLE user_verification_challenges (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('EMAIL','MOBILE')),
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      resend_after TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      consumed_at TEXT,
      PRIMARY KEY (user_id, channel)
    );
  `);
}

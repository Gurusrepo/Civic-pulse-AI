export const version = '020_required_verification_destination';

export function up(db) {
  db.exec(`
    CREATE TABLE user_verification_challenges_next (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('EMAIL','MOBILE')),
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
    FROM user_verification_challenges;

    DROP TABLE user_verification_challenges;
    ALTER TABLE user_verification_challenges_next RENAME TO user_verification_challenges;
  `);
}

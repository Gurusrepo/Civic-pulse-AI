export const version = '019_auth_otp_purposes_and_rate_limits';

export function up(db) {
  db.exec(`
    CREATE TABLE user_verification_challenges_next (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      channel TEXT NOT NULL CHECK (channel IN ('EMAIL','MOBILE')),
      purpose TEXT NOT NULL CHECK (purpose IN ('REGISTRATION','LOGIN','PASSWORD_RESET','PROFILE_VERIFICATION')),
      destination TEXT NOT NULL DEFAULT '',
      code_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      resend_after TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      consumed_at TEXT,
      PRIMARY KEY (user_id, channel, purpose)
    );

    INSERT INTO user_verification_challenges_next
      (user_id,channel,purpose,destination,code_hash,expires_at,resend_after,attempt_count,consumed_at)
    SELECT challenge.user_id,challenge.channel,
      CASE WHEN challenge.channel='EMAIL' AND user.account_status='PENDING_MOBILE_VERIFICATION'
        THEN 'REGISTRATION' ELSE 'PROFILE_VERIFICATION' END,
      challenge.destination,challenge.code_hash,challenge.expires_at,challenge.resend_after,
      challenge.attempt_count,challenge.consumed_at
    FROM user_verification_challenges AS challenge
    JOIN users AS user ON user.id=challenge.user_id;

    DROP TABLE user_verification_challenges;
    ALTER TABLE user_verification_challenges_next RENAME TO user_verification_challenges;

    CREATE TABLE auth_request_rate_limits (
      bucket TEXT NOT NULL,
      identity_hash TEXT NOT NULL,
      window_started_at INTEGER NOT NULL,
      request_count INTEGER NOT NULL CHECK (request_count > 0),
      PRIMARY KEY (bucket, identity_hash)
    );
    CREATE INDEX idx_auth_request_rate_limits_window
      ON auth_request_rate_limits(window_started_at);
  `);
}

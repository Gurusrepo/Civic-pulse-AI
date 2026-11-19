export const version = '014_profile_support_password_reset';

export function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN phone_number TEXT;
    ALTER TABLE users ADD COLUMN date_of_birth TEXT;
    ALTER TABLE users ADD COLUMN date_of_birth_verification_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED'
      CHECK (date_of_birth_verification_status IN ('NOT_VERIFIED','PENDING','VERIFIED','REJECTED'));
    ALTER TABLE users ADD COLUMN address TEXT;
    ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0 CHECK (session_version >= 0);

    CREATE TABLE citizen_support_submissions (
      reference_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      kind TEXT NOT NULL CHECK (kind IN ('BUG_REPORT','SUGGESTION')),
      title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 3 AND 160),
      category TEXT NOT NULL,
      description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 5000),
      screenshot_key TEXT,
      screenshot_mime_type TEXT CHECK (screenshot_mime_type IS NULL OR screenshot_mime_type IN ('image/jpeg','image/png','image/webp')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX idx_citizen_support_user_created
      ON citizen_support_submissions(user_id, created_at DESC);
  `);
}

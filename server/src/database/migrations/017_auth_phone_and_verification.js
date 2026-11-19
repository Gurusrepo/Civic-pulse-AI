export const version = '017_auth_phone_and_verification';

export function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN email_verified_at TEXT;
  `);
  const normalize = db.prepare(`UPDATE users SET phone_number=CASE
    WHEN phone_number GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
      AND substr(phone_number,1,1) IN ('6','7','8','9')
    THEN '+91' || phone_number
    WHEN substr(phone_number,1,3)='+91' AND length(phone_number)=12
    THEN phone_number
    ELSE phone_number END`);
  normalize.run();
  const duplicateCount = db.prepare(`SELECT COUNT(*) AS count
    FROM (SELECT phone_number FROM users WHERE phone_number IS NOT NULL
      GROUP BY phone_number HAVING COUNT(*) > 1)`).get().count;
  if (duplicateCount === 0) {
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_number
      ON users(phone_number) WHERE phone_number IS NOT NULL`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
}

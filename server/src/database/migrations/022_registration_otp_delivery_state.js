export const version = '022_registration_otp_delivery_state';

export function up(db) {
  const columns = db.prepare('PRAGMA table_info(user_verification_challenges)').all();
  if (columns.some((column) => column.name === 'delivery_status')) return;

  db.exec(`ALTER TABLE user_verification_challenges
    ADD COLUMN delivery_status TEXT NOT NULL DEFAULT 'UNKNOWN'
    CHECK (delivery_status IN ('UNKNOWN','PENDING','SENT'))`);
}

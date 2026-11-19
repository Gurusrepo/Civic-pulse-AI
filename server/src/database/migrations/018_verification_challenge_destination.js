export const version = '018_verification_challenge_destination';

export function up(db) {
  const columns = db.prepare('PRAGMA table_info(user_verification_challenges)').all();
  if (!columns.some((column) => column.name === 'destination')) {
    db.exec(`ALTER TABLE user_verification_challenges
      ADD COLUMN destination TEXT NOT NULL DEFAULT ''`);
  }
}

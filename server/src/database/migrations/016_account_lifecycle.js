export const version = '016_account_lifecycle';

export function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN mobile_verified_at TEXT;
    ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'ACTIVE'
      CHECK (account_status IN ('ACTIVE','PENDING_MOBILE_VERIFICATION','DEACTIVATED'));
    ALTER TABLE users ADD COLUMN deactivated_at TEXT;
  `);
}

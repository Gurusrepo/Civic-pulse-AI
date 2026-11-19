export const version = '013_citizen_preferences';

export function up(db) {
  db.exec(`
    ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'en'
      CHECK (language IN ('en','ta'));
    ALTER TABLE users ADD COLUMN appearance TEXT NOT NULL DEFAULT 'system'
      CHECK (appearance IN ('light','dark','system'));
    ALTER TABLE users ADD COLUMN notification_preferences TEXT NOT NULL DEFAULT '{"inApp":true,"email":true,"sms":true}';
    ALTER TABLE users ADD COLUMN accessibility_preferences TEXT NOT NULL DEFAULT '{"fontSize":"medium","highContrast":false,"reducedMotion":false}';
  `);
}

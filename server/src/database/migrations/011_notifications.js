export const version = '011_notifications';

export function up(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
      message TEXT NOT NULL CHECK (length(trim(message)) BETWEEN 1 AND 2000),
      notification_type TEXT NOT NULL CHECK (notification_type IN (
        'ISSUE_RESOLVED','DISPUTE_REVIEWED'
      )),
      related_complaint_id INTEGER REFERENCES complaints(id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      UNIQUE (user_id,event_key)
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_created
      ON notifications(user_id,created_at DESC,id DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_unread
      ON notifications(user_id,is_read,created_at DESC,id DESC);
  `);
}

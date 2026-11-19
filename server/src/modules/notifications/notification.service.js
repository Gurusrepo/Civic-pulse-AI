import { db } from '../../config/database.js';

const mapNotification = (row) => ({
  id: row.id,
  title: row.title,
  message: row.message,
  notificationType: row.notification_type,
  relatedComplaintId: row.related_complaint_id,
  isRead: Boolean(row.is_read),
  createdAt: row.created_at
});

function issueReporters(issueId) {
  return db.prepare(`SELECT c.user_id,MIN(c.id) AS complaint_id
    FROM complaints c JOIN users u ON u.id=c.user_id AND u.role='CITIZEN'
    WHERE c.civic_issue_id=? GROUP BY c.user_id`).all(issueId);
}

function issueDisputers(issueId) {
  return db.prepare(`SELECT c.user_id,MIN(c.id) AS complaint_id
    FROM civic_issue_resolution_verifications v
    JOIN complaints c ON c.id=v.complaint_id
    JOIN users u ON u.id=c.user_id AND u.role='CITIZEN'
    WHERE v.civic_issue_id=? AND v.decision='DISPUTE'
    GROUP BY c.user_id`).all(issueId);
}

function createForRecipients(recipients, { eventKey, notificationType, title, message }) {
  const insert = db.prepare(`INSERT INTO notifications
    (user_id,title,message,notification_type,related_complaint_id,event_key)
    VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,event_key) DO NOTHING`);
  const getPreference = db.prepare('SELECT notification_preferences FROM users WHERE id=?');
  let created = 0;
  for (const recipient of recipients) {
    const preferences = JSON.parse(getPreference.get(recipient.user_id)?.notification_preferences ?? '{"inApp":true}');
    if (preferences.inApp === false) continue;
    created += insert.run(recipient.user_id, title, message, notificationType,
      recipient.complaint_id, eventKey).changes;
  }
  return created;
}

export function notifyIssueReporters(issueId, notification) {
  return createForRecipients(issueReporters(issueId), notification);
}

export function notifyDisputingReporters(issueId, notification) {
  return createForRecipients(issueDisputers(issueId), notification);
}

export function listNotifications(userId, { limit, offset, unreadOnly }) {
  const where = unreadOnly ? 'user_id=? AND is_read=0' : 'user_id=?';
  const rows = db.prepare(`SELECT id,title,message,notification_type,related_complaint_id,is_read,created_at
    FROM notifications WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`)
    .all(userId, limit + 1, offset);
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit).map(mapNotification),
    pagination: { limit, offset, hasMore }
  };
}

export function getUnreadCount(userId) {
  return db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND is_read=0')
    .get(userId).count;
}

export function markNotificationRead(userId, notificationId) {
  db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?')
    .run(notificationId, userId);
  const row = db.prepare(`SELECT id,title,message,notification_type,related_complaint_id,is_read,created_at
    FROM notifications WHERE id=? AND user_id=?`).get(notificationId, userId);
  return row ? mapNotification(row) : null;
}

export function markAllNotificationsRead(userId) {
  return db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=? AND is_read=0')
    .run(userId).changes;
}

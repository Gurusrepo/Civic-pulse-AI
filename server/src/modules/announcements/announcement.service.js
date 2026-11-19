import { db } from '../../config/database.js';

const mapAnnouncement = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  publishedAt: row.published_at
});

export function listAnnouncements({ limit, offset }) {
  const rows = db.prepare(`SELECT id,title,description,published_at
    FROM civic_announcements WHERE is_published=1 AND is_public=1
    ORDER BY published_at DESC,id DESC LIMIT ? OFFSET ?`)
    .all(limit + 1, offset);
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit).map(mapAnnouncement),
    pagination: { limit, offset, hasMore }
  };
}

export function getAnnouncement(id) {
  const row = db.prepare(`SELECT id,title,description,published_at
    FROM civic_announcements WHERE id=? AND is_published=1 AND is_public=1`).get(id);
  return row ? mapAnnouncement(row) : null;
}

export function publishAnnouncement(adminId, { title, description }) {
  const result = db.prepare(`INSERT INTO civic_announcements
    (title,description,published_by_admin_id) VALUES(?,?,?)`)
    .run(title, description, adminId);
  return getAnnouncement(Number(result.lastInsertRowid));
}

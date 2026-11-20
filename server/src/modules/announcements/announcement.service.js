import { db } from '../../config/database.js';

const ANNOUNCEMENT_COLUMNS = `id,title,description,published_at,created_at,
  is_published,is_public,priority,starts_at,expires_at`;

const mapAnnouncement = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  priority: row.priority,
  startsAt: row.starts_at,
  expiresAt: row.expires_at,
  publishedAt: row.published_at
});

const mapAdminAnnouncement = (row) => ({
  ...mapAnnouncement(row),
  createdAt: row.created_at,
  isPublished: Boolean(row.is_published)
});

export class AnnouncementError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertValidSchedule(startsAt, expiresAt) {
  if (startsAt && expiresAt && Date.parse(expiresAt) <= Date.parse(startsAt)) {
    throw new AnnouncementError('Expiry must be later than the start time');
  }
}

export function listAnnouncements({ limit, offset }, now = new Date().toISOString()) {
  const rows = db.prepare(`SELECT ${ANNOUNCEMENT_COLUMNS}
    FROM civic_announcements
    WHERE is_published=1 AND is_public=1
      AND (starts_at IS NULL OR julianday(starts_at) <= julianday(?))
      AND (expires_at IS NULL OR julianday(expires_at) > julianday(?))
    ORDER BY CASE priority
      WHEN 'HIGH' THEN 0
      WHEN 'NORMAL' THEN 1
      ELSE 2
    END, published_at DESC,id DESC
    LIMIT ? OFFSET ?`)
    .all(now, now, limit + 1, offset);
  const hasMore = rows.length > limit;
  return {
    items: rows.slice(0, limit).map(mapAnnouncement),
    pagination: { limit, offset, hasMore }
  };
}

export function getAnnouncement(id, now = new Date().toISOString()) {
  const row = db.prepare(`SELECT ${ANNOUNCEMENT_COLUMNS}
    FROM civic_announcements
    WHERE id=? AND is_published=1 AND is_public=1
      AND (starts_at IS NULL OR julianday(starts_at) <= julianday(?))
      AND (expires_at IS NULL OR julianday(expires_at) > julianday(?))`)
    .get(id, now, now);
  return row ? mapAnnouncement(row) : null;
}

export function listAdminAnnouncements({
  limit, offset, search, status, priority, scheduleStatus
}, now = new Date().toISOString()) {
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('title LIKE ?');
    params.push(`%${search}%`);
  }
  if (status) {
    conditions.push('is_published = ?');
    params.push(status === 'PUBLISHED' ? 1 : 0);
  }
  if (priority) {
    conditions.push('priority = ?');
    params.push(priority);
  }
  if (scheduleStatus === 'UNSCHEDULED') {
    conditions.push('starts_at IS NULL AND expires_at IS NULL');
  } else if (scheduleStatus === 'SCHEDULED') {
    conditions.push('starts_at IS NOT NULL AND julianday(starts_at) > julianday(?)');
    params.push(now);
  } else if (scheduleStatus === 'ACTIVE') {
    conditions.push(`(starts_at IS NULL OR julianday(starts_at) <= julianday(?))
      AND (expires_at IS NULL OR julianday(expires_at) > julianday(?))`);
    params.push(now, now);
  } else if (scheduleStatus === 'EXPIRED') {
    conditions.push('expires_at IS NOT NULL AND julianday(expires_at) <= julianday(?)');
    params.push(now);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count
    FROM civic_announcements ${whereClause}`).get(...params).count;
  const rows = db.prepare(`SELECT ${ANNOUNCEMENT_COLUMNS}
    FROM civic_announcements ${whereClause}
    ORDER BY created_at DESC,id DESC
    LIMIT ? OFFSET ?`)
    .all(...params, limit + 1, offset);
  const hasMore = rows.length > limit;

  return {
    items: rows.slice(0, limit).map(mapAdminAnnouncement),
    pagination: { limit, offset, hasMore, total }
  };
}

export function getAdminAnnouncement(id) {
  const row = db.prepare(`SELECT ${ANNOUNCEMENT_COLUMNS}
    FROM civic_announcements WHERE id=?`).get(id);
  return row ? mapAdminAnnouncement(row) : null;
}

export function createAnnouncement(adminId, {
  title, description, priority = 'NORMAL', startsAt = null, expiresAt = null
}) {
  assertValidSchedule(startsAt, expiresAt);
  const result = db.prepare(`INSERT INTO civic_announcements
    (title,description,published_by_admin_id,is_published,priority,starts_at,expires_at)
    VALUES(?,?,?,0,?,?,?)`)
    .run(title, description, adminId, priority, startsAt, expiresAt);
  return getAdminAnnouncement(Number(result.lastInsertRowid));
}

const editableColumns = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  startsAt: 'starts_at',
  expiresAt: 'expires_at'
};

export function updateAnnouncement(id, updates) {
  const current = db.prepare(`SELECT ${ANNOUNCEMENT_COLUMNS}
    FROM civic_announcements WHERE id=?`).get(id);
  if (!current) return null;

  const startsAt = updates.startsAt !== undefined ? updates.startsAt : current.starts_at;
  const expiresAt = updates.expiresAt !== undefined ? updates.expiresAt : current.expires_at;
  assertValidSchedule(startsAt, expiresAt);

  const entries = Object.entries(updates);
  const assignments = entries.map(([field]) => `${editableColumns[field]} = ?`).join(', ');
  db.prepare(`UPDATE civic_announcements SET ${assignments} WHERE id=?`)
    .run(...entries.map(([, value]) => value), id);
  return getAdminAnnouncement(id);
}

export function setAnnouncementPublication(id, isPublished) {
  const current = db.prepare(`SELECT is_published
    FROM civic_announcements WHERE id=?`).get(id);
  if (!current) return null;

  const nextState = Number(isPublished);
  if (current.is_published !== nextState) {
    if (nextState) {
      db.prepare(`UPDATE civic_announcements
        SET is_published=1,published_at=? WHERE id=?`)
        .run(new Date().toISOString(), id);
    } else {
      db.prepare('UPDATE civic_announcements SET is_published=0 WHERE id=?').run(id);
    }
  }
  return getAdminAnnouncement(id);
}

export function deleteAnnouncement(id) {
  return db.prepare('DELETE FROM civic_announcements WHERE id=?').run(id).changes > 0;
}

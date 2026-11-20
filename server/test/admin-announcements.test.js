import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-admin-announcements-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDirectory, 'announcements.sqlite');
process.env.JWT_SECRET = 'admin-announcements-test-secret-long-enough';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';

const { db, closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
migrateDatabase(db);
const { default: app } = await import('../src/app.js');
const announcementService = await import('../src/modules/announcements/announcement.service.js');

let server;
let baseUrl;

function addUser(id, role, name) {
  db.prepare(`INSERT INTO users
    (id,display_name,email,password_hash,role,email_verified,account_status)
    VALUES(?,?,?,'test-hash',?,1,'ACTIVE')`)
    .run(id, name, `${name.toLowerCase().replaceAll(' ', '.')}@example.test`, role);
}

function tokenFor(userId) {
  const { session_version: version } = db.prepare('SELECT session_version FROM users WHERE id=?').get(userId);
  return jwt.sign({ ver: version }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(userId),
    issuer: 'civicpulse-api',
    audience: 'civicpulse-client'
  });
}

async function request(pathname, { userId, method = 'GET', body } = {}) {
  const headers = {};
  if (userId !== undefined) headers.cookie = `civicpulse_token=${tokenFor(userId)}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

function addAnnouncement({
  title,
  priority = 'NORMAL',
  startsAt = null,
  expiresAt = null,
  isPublished = true,
  isPublic = true,
  publishedAt = new Date().toISOString()
}) {
  const result = db.prepare(`INSERT INTO civic_announcements
    (title,description,published_by_admin_id,is_published,is_public,priority,starts_at,expires_at,published_at)
    VALUES(?, 'Announcement test content', 1, ?, ?, ?, ?, ?, ?)`)
    .run(title, Number(isPublished), Number(isPublic), priority, startsAt, expiresAt, publishedAt);
  return Number(result.lastInsertRowid);
}

before(async () => {
  addUser(1, 'ADMIN', 'Announcements Admin');
  addUser(2, 'CITIZEN', 'Announcements Citizen');
  addUser(3, 'OFFICER', 'Announcements Officer');
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('announcement administration endpoints require an authenticated admin', async () => {
  const requests = [
    { pathname: '/api/admin/announcements' },
    { pathname: '/api/admin/announcements/1' },
    { pathname: '/api/admin/announcements', method: 'POST', body: { title: 'Town notice', description: 'Public information.' } },
    { pathname: '/api/admin/announcements/1', method: 'PATCH', body: { title: 'Updated notice' } },
    { pathname: '/api/admin/announcements/1/publication', method: 'PATCH', body: { isPublished: true } },
    { pathname: '/api/admin/announcements/1', method: 'DELETE' }
  ];

  for (const { pathname, ...options } of requests) {
    assert.equal((await request(pathname, options)).status, 401);
    for (const userId of [2, 3]) {
      assert.equal((await request(pathname, { ...options, userId })).status, 403);
    }
  }
});

test('admins can create, list, edit, publish, unpublish and delete announcements', async () => {
  const createdResponse = await request('/api/admin/announcements', {
    userId: 1,
    method: 'POST',
    body: { title: 'Community update', description: 'Initial announcement content.' }
  });
  assert.equal(createdResponse.status, 201);
  const { announcement: draft } = await createdResponse.json();
  assert.equal(draft.title, 'Community update');
  assert.equal(draft.priority, 'NORMAL');
  assert.equal(draft.isPublished, false);
  assert.equal(draft.startsAt, null);
  assert.equal(draft.expiresAt, null);
  assert.ok(draft.createdAt);

  const scheduledResponse = await request('/api/admin/announcements', {
    userId: 1,
    method: 'POST',
    body: {
      title: 'Scheduled notice',
      description: 'This announcement starts later.',
      priority: 'HIGH',
      startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    }
  });
  assert.equal(scheduledResponse.status, 201);
  const { announcement: scheduledDraft } = await scheduledResponse.json();
  assert.equal(scheduledDraft.isPublished, false);

  const firstPage = await request('/api/admin/announcements?limit=1&offset=0', { userId: 1 });
  assert.equal(firstPage.status, 200);
  const firstPageResult = await firstPage.json();
  assert.equal(firstPageResult.pagination.total, 2);
  assert.equal(firstPageResult.pagination.hasMore, true);
  const secondPage = await request('/api/admin/announcements?limit=1&offset=1', { userId: 1 });
  const secondPageResult = await secondPage.json();
  assert.equal(secondPageResult.items.length, 1);
  assert.equal(secondPageResult.pagination.hasMore, false);

  const filtered = await request(
    '/api/admin/announcements?search=Scheduled&status=DRAFT&priority=HIGH&scheduleStatus=SCHEDULED',
    { userId: 1 }
  );
  assert.equal(filtered.status, 200);
  assert.deepEqual((await filtered.json()).items.map((item) => item.id), [scheduledDraft.id]);

  const editedResponse = await request(`/api/admin/announcements/${draft.id}`, {
    userId: 1,
    method: 'PATCH',
    body: { description: 'Updated announcement content.' }
  });
  assert.equal(editedResponse.status, 200);
  const { announcement: edited } = await editedResponse.json();
  assert.equal(edited.title, draft.title);
  assert.equal(edited.description, 'Updated announcement content.');
  assert.equal(edited.priority, 'NORMAL');
  assert.equal(edited.isPublished, false);

  const publishResponse = await request(`/api/admin/announcements/${scheduledDraft.id}/publication`, {
    userId: 1,
    method: 'PATCH',
    body: { isPublished: true }
  });
  assert.equal(publishResponse.status, 200);
  const { announcement: published } = await publishResponse.json();
  assert.equal(published.isPublished, true);
  assert.equal(published.priority, 'HIGH');
  assert.equal(published.startsAt, scheduledDraft.startsAt);
  assert.equal(published.expiresAt, scheduledDraft.expiresAt);
  assert.ok(published.publishedAt);

  const citizenList = await request('/api/announcements?limit=50&offset=0', { userId: 2 });
  assert.equal((await citizenList.json()).items.some((item) => item.id === scheduledDraft.id), false);
  assert.equal((await request(`/api/announcements/${scheduledDraft.id}`, { userId: 2 })).status, 404);

  const publishedFilter = await request('/api/admin/announcements?status=PUBLISHED', { userId: 1 });
  assert.deepEqual((await publishedFilter.json()).items.map((item) => item.id), [scheduledDraft.id]);

  const editedPublishedResponse = await request(`/api/admin/announcements/${scheduledDraft.id}`, {
    userId: 1,
    method: 'PATCH',
    body: { description: 'Updated while published.' }
  });
  assert.equal(editedPublishedResponse.status, 200);
  const { announcement: editedPublished } = await editedPublishedResponse.json();
  assert.equal(editedPublished.isPublished, true);
  assert.equal(editedPublished.description, 'Updated while published.');
  assert.equal(editedPublished.startsAt, scheduledDraft.startsAt);
  assert.equal(editedPublished.expiresAt, scheduledDraft.expiresAt);

  const unpublishResponse = await request(`/api/admin/announcements/${scheduledDraft.id}/publication`, {
    userId: 1,
    method: 'PATCH',
    body: { isPublished: false }
  });
  assert.equal(unpublishResponse.status, 200);
  const { announcement: unpublished } = await unpublishResponse.json();
  assert.equal(unpublished.isPublished, false);
  assert.equal(unpublished.publishedAt, editedPublished.publishedAt);
  assert.equal(unpublished.startsAt, scheduledDraft.startsAt);
  assert.equal(unpublished.expiresAt, scheduledDraft.expiresAt);

  const deleted = await request(`/api/admin/announcements/${scheduledDraft.id}`, {
    userId: 1,
    method: 'DELETE'
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { deleted: true });
  assert.equal((await request(`/api/admin/announcements/${scheduledDraft.id}`, { userId: 1 })).status, 404);
  assert.equal((await request(`/api/admin/announcements/${scheduledDraft.id}`, {
    userId: 1,
    method: 'DELETE'
  })).status, 404);
});

test('announcement validation rejects invalid fields, priorities and schedule ranges', async () => {
  const invalidCases = [
    { title: 'No', description: 'Too short title.' },
    { title: 'Bad priority', description: 'Content.', priority: 'URGENT' },
    { title: 'Bad time', description: 'Content.', startsAt: '2026-01-01T00:00:00+01:00' },
    { title: 'Invalid timestamp', description: 'Content.', expiresAt: 'not-a-timestamp' },
    {
      title: 'Invalid range',
      description: 'Content.',
      startsAt: '2026-01-02T00:00:00.000Z',
      expiresAt: '2026-01-01T00:00:00.000Z'
    }
  ];
  for (const body of invalidCases) {
    assert.equal((await request('/api/admin/announcements', {
      userId: 1,
      method: 'POST',
      body
    })).status, 400);
  }

  const created = await request('/api/admin/announcements', {
    userId: 1,
    method: 'POST',
    body: {
      title: 'Scheduled for edit',
      description: 'A valid initial schedule.',
      startsAt: '2026-01-02T00:00:00.000Z',
      expiresAt: '2026-01-03T00:00:00.000Z'
    }
  });
  const { announcement } = await created.json();
  const invalidEdit = await request(`/api/admin/announcements/${announcement.id}`, {
    userId: 1,
    method: 'PATCH',
    body: { expiresAt: '2026-01-01T00:00:00.000Z' }
  });
  assert.equal(invalidEdit.status, 400);
  assert.equal((await (await request(`/api/admin/announcements/${announcement.id}`, {
    userId: 1
  })).json()).announcement.expiresAt, '2026-01-03T00:00:00.000Z');

  assert.equal((await request('/api/admin/announcements/0', { userId: 1 })).status, 400);
  assert.equal((await request('/api/admin/announcements/999', { userId: 1 })).status, 404);
  assert.equal((await request('/api/admin/announcements/999/publication', {
    userId: 1,
    method: 'PATCH',
    body: { isPublished: true }
  })).status, 404);
});

test('citizen visibility honors UTC boundaries and priority ordering', () => {
  const now = '2026-11-20T12:00:00.000Z';
  const highAtStart = addAnnouncement({
    title: 'High at start boundary',
    priority: 'HIGH',
    startsAt: now,
    expiresAt: '2026-11-20T13:00:00.000Z',
    publishedAt: '2026-11-20T11:00:00.000Z'
  });
  const normalNewest = addAnnouncement({
    title: 'Newest normal',
    publishedAt: '2026-11-20T11:30:00.000Z'
  });
  const normalOldest = addAnnouncement({
    title: 'Oldest normal',
    publishedAt: '2026-11-20T11:10:00.000Z'
  });
  const low = addAnnouncement({
    title: 'Low priority',
    priority: 'LOW',
    publishedAt: '2026-11-20T11:59:00.000Z'
  });
  const scheduled = addAnnouncement({
    title: 'Future start',
    startsAt: '2026-11-20T12:00:00.001Z',
    expiresAt: '2026-11-20T13:00:00.000Z',
    publishedAt: '2026-11-20T11:59:00.000Z'
  });
  const expired = addAnnouncement({
    title: 'Past expiry',
    expiresAt: '2026-11-20T11:59:59.999Z',
    publishedAt: '2026-11-20T11:59:00.000Z'
  });
  const expiringNow = addAnnouncement({
    title: 'Expiry boundary',
    expiresAt: now,
    publishedAt: '2026-11-20T11:59:00.000Z'
  });
  const draft = addAnnouncement({
    title: 'Draft',
    priority: 'HIGH',
    isPublished: false,
    publishedAt: '2026-11-20T11:59:00.000Z'
  });
  const privateAnnouncement = addAnnouncement({
    title: 'Private',
    priority: 'HIGH',
    isPublic: false,
    publishedAt: '2026-11-20T11:59:00.000Z'
  });

  const citizenList = announcementService.listAnnouncements({ limit: 20, offset: 0 }, now);
  assert.deepEqual(citizenList.items.map((item) => item.title), [
    'High at start boundary',
    'Newest normal',
    'Oldest normal',
    'Low priority'
  ]);
  assert.ok(citizenList.items.some((item) => item.id === highAtStart));
  assert.equal(announcementService.getAnnouncement(highAtStart, now).id, highAtStart);
  for (const hiddenId of [scheduled, expired, expiringNow, draft, privateAnnouncement]) {
    assert.equal(announcementService.getAnnouncement(hiddenId, now), null);
  }

  const scheduledItems = announcementService.listAdminAnnouncements({
    limit: 20,
    offset: 0,
    scheduleStatus: 'SCHEDULED'
  }, now);
  assert.ok(scheduledItems.items.some((item) => item.id === scheduled));
  const expiredItems = announcementService.listAdminAnnouncements({
    limit: 20,
    offset: 0,
    scheduleStatus: 'EXPIRED'
  }, now);
  assert.ok(expiredItems.items.some((item) => item.id === expired));
  assert.ok(expiredItems.items.some((item) => item.id === expiringNow));
  const activeItems = announcementService.listAdminAnnouncements({
    limit: 20,
    offset: 0,
    scheduleStatus: 'ACTIVE'
  }, now);
  assert.ok(activeItems.items.some((item) => item.id === highAtStart));
  const unscheduledItems = announcementService.listAdminAnnouncements({
    limit: 20,
    offset: 0,
    scheduleStatus: 'UNSCHEDULED'
  }, now);
  assert.ok(unscheduledItems.items.some((item) => item.id === normalNewest));
  assert.ok(unscheduledItems.items.some((item) => item.id === normalOldest));
  assert.ok(unscheduledItems.items.some((item) => item.id === low));
  assert.ok(unscheduledItems.items.some((item) => item.id === draft));
});

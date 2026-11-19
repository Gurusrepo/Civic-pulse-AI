import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-complaint-timeline-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDirectory, 'timeline.sqlite');
process.env.JWT_SECRET = 'complaint-timeline-test-secret-long-enough';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';

const { db, closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
migrateDatabase(db);
const { default: app } = await import('../src/app.js');

let server;
let baseUrl;
const complaintIds = new Map();
const issueId = Number(db.prepare("INSERT INTO civic_issues (status) VALUES ('OPEN')").run().lastInsertRowid);

function tokenFor(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
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

before(async () => {
  for (const [id, name] of [[1, 'Timeline Admin'], [2, 'First Citizen'], [3, 'Second Citizen']]) {
    db.prepare(`INSERT INTO users (id,display_name,email,password_hash,role,email_verified)
      VALUES (?,?,?,'test-hash',?,?)`).run(id, name, `${name.toLowerCase().replaceAll(' ', '.')}@example.test`,
      id === 1 ? 'ADMIN' : 'CITIZEN', id === 1 ? 0 : 1);
  }
  for (const id of [2, 3]) {
    const result = db.prepare(`INSERT INTO complaints
      (user_id,civic_issue_id,title,description,latitude,longitude)
      VALUES (?,?,'Street light outage','A street light is not working.',1,2)`).run(id, issueId);
    complaintIds.set(id, Number(result.lastInsertRowid));
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('timeline is complaint-owned and exposes only the current citizen’s verification', async () => {
  const ownId = complaintIds.get(2);
  const otherId = complaintIds.get(3);

  const initial = await request(`/api/complaints/${ownId}/timeline`, { userId: 2 });
  assert.equal(initial.status, 200);
  const initialItems = (await initial.json()).items;
  assert.deepEqual(initialItems.map((item) => item.eventType), ['REPORT_SUBMITTED']);
  assert.ok(initialItems[0].createdAt);
  assert.equal((await request(`/api/complaints/${otherId}/timeline`, { userId: 2 })).status, 404);
  assert.equal((await request('/api/complaints/not-an-id/timeline', { userId: 2 })).status, 400);
  assert.equal((await request(`/api/complaints/${ownId}/timeline`)).status, 401);

  db.prepare("UPDATE civic_issues SET status='RESOLVED' WHERE id=?").run(issueId);
  const firstResponse = await request(`/api/complaints/${ownId}/resolution-verification`, {
    userId: 2,
    method: 'POST',
    body: { decision: 'CONFIRM' }
  });
  assert.equal(firstResponse.status, 201);
  const secondResponse = await request(`/api/complaints/${otherId}/resolution-verification`, {
    userId: 3,
    method: 'POST',
    body: { decision: 'DISPUTE', reason: 'The street light is still not working.' }
  });
  assert.equal(secondResponse.status, 201);

  const firstTimeline = (await (await request(`/api/complaints/${ownId}/timeline`, { userId: 2 })).json()).items;
  assert.ok(firstTimeline.some((item) => item.eventType === 'RESOLUTION_CONFIRMED'));
  assert.equal(firstTimeline.some((item) => item.eventType === 'RESOLUTION_DISPUTED'), false);

  const secondTimeline = (await (await request(`/api/complaints/${otherId}/timeline`, { userId: 3 })).json()).items;
  assert.ok(secondTimeline.some((item) => item.eventType === 'RESOLUTION_DISPUTED'));
  assert.equal(secondTimeline.some((item) => item.eventType === 'RESOLUTION_CONFIRMED'), false);
});

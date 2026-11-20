import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-admin-dashboard-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDirectory, 'dashboard.sqlite');
process.env.JWT_SECRET = 'admin-dashboard-test-secret-long-enough';
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

function tokenFor(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(userId),
    issuer: 'civicpulse-api',
    audience: 'civicpulse-client'
  });
}

async function request(pathname, userId) {
  const headers = userId === undefined
    ? {}
    : { cookie: `civicpulse_token=${tokenFor(userId)}` };
  return fetch(`${baseUrl}${pathname}`, { headers });
}

function addUser(id, role, name, accountStatus = 'ACTIVE') {
  db.prepare(`INSERT INTO users
    (id,display_name,email,password_hash,role,email_verified,account_status)
    VALUES(?,?,?,'test-hash',?,1,?)`)
    .run(id, name, `${name.toLowerCase().replaceAll(' ', '.')}@example.test`, role, accountStatus);
}

function addComplaint(userId, issueStatus, title) {
  const issueId = Number(db.prepare('INSERT INTO civic_issues (status) VALUES (?)')
    .run(issueStatus).lastInsertRowid);
  return Number(db.prepare(`INSERT INTO complaints
    (user_id,civic_issue_id,title,description,latitude,longitude)
    VALUES(?,?,?,'A sufficiently detailed test description.',12.3,45.6)`)
    .run(userId, issueId, title).lastInsertRowid);
}

before(async () => {
  addUser(1, 'ADMIN', 'Civic Admin');

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('empty dashboard uses zero counts and empty recent lists', async () => {
  const response = await request('/api/admin/dashboard', 1);
  assert.equal(response.status, 200);

  const result = await response.json();
  assert.deepEqual(result.summary, {
    totalComplaints: 0,
    openComplaints: 0,
    inProgressComplaints: 0,
    resolvedComplaints: 0,
    reportedProblems: 0,
    suggestions: 0,
    activeOfficers: 0,
    publishedAnnouncements: 0
  });
  assert.deepEqual(result.recent, {
    complaints: [],
    supportSubmissions: [],
    announcements: []
  });
});

test('dashboard endpoint rejects unauthenticated users, citizens, and officers', async () => {
  assert.equal((await request('/api/admin/dashboard')).status, 401);

  addUser(2, 'CITIZEN', 'Citizen A');
  addUser(3, 'OFFICER', 'Officer A');
  for (const userId of [2, 3]) {
    assert.equal((await request('/api/admin/dashboard', userId)).status, 403);
  }
});

test('Admin dashboard reports database counts and recent records without private fields', async () => {
  addComplaint(2, 'OPEN', 'Open road issue');
  addComplaint(2, 'IN_PROGRESS', 'Water repair');
  addComplaint(2, 'RESOLVED', 'Resolved streetlight');
  addUser(4, 'OFFICER', 'Officer Active');
  addUser(5, 'OFFICER', 'Officer Inactive', 'DEACTIVATED');

  db.prepare(`INSERT INTO citizen_support_submissions
    (reference_id,user_id,kind,title,category,description,screenshot_key)
    VALUES
      ('NM-BUG-01',2,'BUG_REPORT','Login problem','LOGIN_ISSUE','Cannot sign in to my account.','support-attachments/private.png'),
      ('NM-SUG-01',2,'SUGGESTION','Add language option','ACCESSIBILITY','Please add another language option.',NULL)`).run();

  db.prepare(`INSERT INTO civic_announcements
    (title,description,published_by_admin_id,is_published,is_public)
    VALUES
      ('Published notice','Public notice details',1,1,1),
      ('Draft notice','Not visible to citizens',1,0,1),
      ('Private notice','Not public',1,1,0)`).run();

  const response = await request('/api/admin/dashboard', 1);
  assert.equal(response.status, 200);
  const result = await response.json();

  assert.deepEqual(result.summary, {
    totalComplaints: 3,
    openComplaints: 1,
    inProgressComplaints: 1,
    resolvedComplaints: 1,
    reportedProblems: 1,
    suggestions: 1,
    activeOfficers: 2,
    publishedAnnouncements: 1
  });
  assert.equal(result.recent.complaints.length, 3);
  assert.equal(result.recent.supportSubmissions.length, 2);
  assert.equal(result.recent.announcements.length, 1);
  assert.equal(result.recent.announcements[0].title, 'Published notice');

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /example\.test|private\.png|screenshot_key|description/);
});

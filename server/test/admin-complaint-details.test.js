import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-admin-media-test-'));
Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_PATH: path.join(tempDirectory, 'admin-media.sqlite'),
  JWT_SECRET: 'admin-media-test-secret-long-enough',
  CORS_ORIGINS: 'http://localhost:3000',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'test-key',
  GEMINI_API_KEY: 'test-key',
  GEMINI_MODEL: 'gemini-3.5-flash-lite'
});

const { db, closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
migrateDatabase(db);
const { createAdminRouter } = await import('../src/modules/admin/admin.routes.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');

const signedKeys = [];
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/admin', createAdminRouter({
  createComplaintReadUrl: async (key) => {
    signedKeys.push(key);
    return `signed:${key}`;
  },
  createRepairEvidenceReadUrl: async (key) => `signed:${key}`,
  createSupportAttachmentReadUrl: async (key) => `signed:${key}`
}));
app.use(errorHandler);

let server;
let baseUrl;
let issueId;

function tokenFor(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(userId),
    issuer: 'civicpulse-api',
    audience: 'civicpulse-client'
  });
}

async function request(pathname, userId) {
  return fetch(`${baseUrl}${pathname}`, {
    headers: { cookie: `civicpulse_token=${tokenFor(userId)}` }
  });
}

before(async () => {
  db.prepare(`INSERT INTO users(id,display_name,email,password_hash,role,email_verified)
    VALUES(1,'Admin','admin@example.test','hash','ADMIN',1),(2,'Citizen','citizen@example.test','hash','CITIZEN',1)`).run();
  issueId = Number(db.prepare('INSERT INTO civic_issues DEFAULT VALUES').run().lastInsertRowid);
  const complaintId = Number(db.prepare(`INSERT INTO complaints
    (user_id,civic_issue_id,title,description,address,latitude,longitude)
    VALUES(2,?,'Broken streetlight','A streetlight has been broken for several days.','North Street',12.1,77.2)`)
    .run(issueId).lastInsertRowid);
  db.prepare(`INSERT INTO complaint_media
    (complaint_id,uploader_id,object_key,media_type,mime_type,byte_size)
    VALUES(?,2,'complaints/private-photo.jpg','IMAGE','image/jpeg',128)`).run(complaintId);
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('Admin issue detail returns linked report location and short-lived media URLs without citizen identity', async () => {
  const response = await request(`/api/admin/civic-issues/${issueId}`, 1);
  assert.equal(response.status, 200);
  const { issue } = await response.json();
  assert.equal(issue.linkedComplaints.length, 1);
  const [complaint] = issue.linkedComplaints;
  assert.equal(complaint.title, 'Broken streetlight');
  assert.equal(complaint.address, 'North Street');
  assert.deepEqual(complaint.location, { latitude: 12.1, longitude: 77.2, accuracyMeters: null });
  assert.deepEqual(complaint.media.map(({ url }) => url), ['signed:complaints/private-photo.jpg']);
  assert.doesNotMatch(JSON.stringify(complaint), /citizen@example\.test|user_id|uploader_id/);
  assert.deepEqual(signedKeys, ['complaints/private-photo.jpg']);
});

test('citizens cannot use the Admin issue detail endpoint to obtain media URLs', async () => {
  signedKeys.length = 0;
  const response = await request(`/api/admin/civic-issues/${issueId}`, 2);
  assert.equal(response.status, 403);
  assert.deepEqual(signedKeys, []);
});

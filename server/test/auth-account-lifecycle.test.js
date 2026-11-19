import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-account-lifecycle-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDirectory, 'account-lifecycle.sqlite');
process.env.JWT_SECRET = 'account-lifecycle-test-secret-long-enough';
process.env.OTP_SECRET = 'account-lifecycle-otp-secret-distinct-from-jwt';
process.env.JWT_EXPIRES_IN = '5m';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key';

const { db, closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
migrateDatabase(db);
const { default: app } = await import('../src/app.js');

let server;
let baseUrl;
const accountPassword = 'AccountDeletionPassword123';

function tokenFor(userId) {
  return jwt.sign({ ver: 0 }, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: String(userId), expiresIn: '5m',
    issuer: 'civicpulse-api', audience: 'civicpulse-client'
  });
}

async function request(pathname, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

before(async () => {
  const passwordHash = await bcrypt.hash(accountPassword, 4);
  db.prepare(`INSERT INTO users
    (id,display_name,email,password_hash,role,phone_number,email_verified,account_status)
    VALUES (1,'Delete Me','delete-me@example.test',?,'CITIZEN','+919876543210',1,'ACTIVE'),
      (2,'Another Citizen','another@example.test',?,'CITIZEN','+919876543211',1,'ACTIVE')`)
    .run(passwordHash, passwordHash);
  db.prepare(`INSERT INTO complaints(user_id,title,description,latitude,longitude)
    VALUES (1,'Retained issue','A sufficiently detailed civic issue report.',12.3,45.6)`).run();
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('account deactivation requires authentication and password re-authentication, retains records, and revokes sessions', async () => {
  const cookie = `civicpulse_token=${tokenFor(1)}`;
  assert.equal((await request('/api/auth/account', { method: 'DELETE', body: { password: accountPassword, confirmation: 'DELETE' } })).status, 401);

  const invalidPassword = await request('/api/auth/account', {
    method: 'DELETE', cookie, body: { password: 'wrong-password', confirmation: 'DELETE' }
  });
  assert.equal(invalidPassword.status, 401);
  assert.equal(db.prepare('SELECT account_status FROM users WHERE id=1').get().account_status, 'ACTIVE');

  const attemptedTarget = await request('/api/auth/account', {
    method: 'DELETE', cookie, body: { password: accountPassword, confirmation: 'DELETE', userId: 2 }
  });
  assert.equal(attemptedTarget.status, 400);
  assert.equal(db.prepare('SELECT account_status FROM users WHERE id=2').get().account_status, 'ACTIVE');

  const wrongConfirmation = await request('/api/auth/account', {
    method: 'DELETE', cookie, body: { password: accountPassword, confirmation: 'delete' }
  });
  assert.equal(wrongConfirmation.status, 400);
  assert.equal(db.prepare('SELECT account_status FROM users WHERE id=1').get().account_status, 'ACTIVE');

  const response = await request('/api/auth/account', {
    method: 'DELETE', cookie, body: { password: accountPassword, confirmation: 'DELETE' }
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, 'DEACTIVATED');
  assert.match(result.message, /not permanently deleted/i);
  assert.match(response.headers.get('set-cookie'), /civicpulse_token=;/);
  assert.deepEqual(db.prepare('SELECT account_status,session_version FROM users WHERE id=1').get(), {
    account_status: 'DEACTIVATED', session_version: 1
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM complaints WHERE user_id=1').get().count, 1);
  assert.equal(db.prepare('SELECT account_status FROM users WHERE id=2').get().account_status, 'ACTIVE');
  assert.equal((await request('/api/auth/me', { cookie })).status, 401);
  assert.equal((await request('/api/auth/login', {
    method: 'POST', body: { email: 'delete-me@example.test', password: accountPassword }
  })).status, 401);
});

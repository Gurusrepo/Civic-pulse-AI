import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-ward-team-test-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_PATH: path.join(tempDirectory, 'ward-team.sqlite'),
  JWT_SECRET: 'ward-team-test-secret-long-enough-for-validation', CORS_ORIGINS: 'http://localhost:3000',
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-key',
  GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.5-flash-lite'
});

const { db, closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
migrateDatabase(db);
const { default: app } = await import('../src/app.js');

let server;
let baseUrl;
let wardId;
let teamId;

function addUser(id, role) {
  db.prepare(`INSERT INTO users(id,display_name,email,password_hash,role,email_verified)
    VALUES(?,?,?,'test-hash',?,?)`).run(id, `Test ${role} ${id}`, `ward-test-${id}@example.test`, role,
    role === 'CITIZEN' ? 1 : 0);
}
function tokenFor(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: String(userId), issuer: 'civicpulse-api', audience: 'civicpulse-client'
  });
}
async function request(pathname, { userId = 1, method = 'GET', body } = {}) {
  const headers = { cookie: `civicpulse_token=${tokenFor(userId)}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, {
    method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

before(async () => {
  addUser(1, 'ADMIN'); addUser(2, 'CITIZEN'); addUser(3, 'OFFICER'); addUser(4, 'OFFICER');
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('ADMIN can create, read, update and safely deactivate wards', async () => {
  const create = await request('/api/admin/wards', { method: 'POST', body: { code: ' north-01 ', name: ' North Ward ' } });
  assert.equal(create.status, 201);
  const { ward } = await create.json();
  wardId = ward.id;
  assert.equal(ward.code, 'NORTH-01');
  assert.equal(ward.name, 'North Ward');

  assert.equal((await request(`/api/admin/wards/${wardId}`)).status, 200);
  assert.equal((await request('/api/admin/wards')).status, 200);
  assert.equal((await request(`/api/admin/wards/${wardId}`, { method: 'PATCH', body: { name: 'North Central' } })).status, 200);

  const duplicateCode = await request('/api/admin/wards', { method: 'POST', body: { code: 'north-01', name: 'Duplicate' } });
  assert.equal(duplicateCode.status, 409);

  const teamResponse = await request('/api/admin/ward-teams', {
    method: 'POST', body: { wardId, name: 'Roads Team', department: 'Roads & Infrastructure' }
  });
  teamId = (await teamResponse.json()).team.id;
  const cannotDeactivate = await request(`/api/admin/wards/${wardId}`, { method: 'DELETE' });
  assert.equal(cannotDeactivate.status, 409);
});

test('teams validate departments and active ward state; updates and listing are ADMIN-only', async () => {
  const invalidDepartment = await request('/api/admin/ward-teams', {
    method: 'POST', body: { wardId, name: 'Invalid Department Team', department: 'Unknown Department' }
  });
  assert.equal(invalidDepartment.status, 400);

  const list = await request(`/api/admin/ward-teams?wardId=${wardId}`);
  assert.equal(list.status, 200);
  assert.equal((await list.json()).items[0].department, 'Roads & Infrastructure');
  assert.equal((await request(`/api/admin/ward-teams/${teamId}`, {
    method: 'PATCH', body: { department: 'Water Supply', name: 'Water Team' }
  })).status, 200);

  const inactiveWard = await request(`/api/admin/wards/${wardId}`, { method: 'PATCH', body: { active: false } });
  assert.equal(inactiveWard.status, 409);
  await request(`/api/admin/ward-teams/${teamId}`, { method: 'PATCH', body: { active: false } });
  const inactiveTeamList = await request('/api/admin/ward-teams');
  assert.equal((await inactiveTeamList.json()).items.some(team => team.id === teamId), false);
  const cannotReactivateInInactiveWard = await request(`/api/admin/ward-teams/${teamId}`, {
    method: 'PATCH', body: { active: true }
  });
  assert.equal(cannotReactivateInInactiveWard.status, 200);
});

test('only OFFICER users can join active teams; removal and rejoining preserve membership history', async () => {
  const addCitizen = await request(`/api/admin/ward-teams/${teamId}/members`, {
    method: 'POST', body: { officerId: 2 }
  });
  assert.equal(addCitizen.status, 400);

  const added = await request(`/api/admin/ward-teams/${teamId}/members`, {
    method: 'POST', body: { officerId: 3 }
  });
  assert.equal(added.status, 201);
  const firstMembership = (await added.json()).membership;
  assert.equal(firstMembership.active, true);

  const duplicate = await request(`/api/admin/ward-teams/${teamId}/members`, {
    method: 'POST', body: { officerId: 3 }
  });
  assert.equal(duplicate.status, 409);
  const teamDeactivate = await request(`/api/admin/ward-teams/${teamId}`, { method: 'PATCH', body: { active: false } });
  assert.equal(teamDeactivate.status, 409);
  assert.throws(() => db.prepare("UPDATE users SET role='CITIZEN' WHERE id=3").run());

  const removed = await request(`/api/admin/ward-teams/${teamId}/members/3`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).membership.active, false);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ward_team_memberships').get().count, 1);

  const rejoined = await request(`/api/admin/ward-teams/${teamId}/members`, {
    method: 'POST', body: { officerId: 3 }
  });
  assert.equal(rejoined.status, 201);
  const history = await request(`/api/admin/ward-teams/${teamId}/members?includeHistory=true`);
  const memberships = (await history.json()).items;
  assert.equal(memberships.length, 2);
  assert.equal(memberships.filter(row => row.active).length, 1);
  assert.equal(memberships.filter(row => !row.active).length, 1);
  assert.notEqual(memberships[0].membershipId, memberships[1].membershipId);
});

test('citizens and officers cannot access ward or team administration', async () => {
  for (const userId of [2, 3]) {
    assert.equal((await request('/api/admin/wards', { userId })).status, 403);
    assert.equal((await request('/api/admin/ward-teams', { userId })).status, 403);
    assert.equal((await request(`/api/admin/ward-teams/${teamId}/members`, { userId })).status, 403);
    assert.equal((await request(`/api/admin/ward-teams/${teamId}/members`, {
      userId, method: 'POST', body: { officerId: 4 }
    })).status, 403);
  }
});

test('soft deletion retains wards and team membership history', async () => {
  await request(`/api/admin/ward-teams/${teamId}/members/3`, { method: 'DELETE' });
  await request(`/api/admin/ward-teams/${teamId}`, { method: 'PATCH', body: { active: false } });
  const deleted = await request(`/api/admin/wards/${wardId}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).ward.active, false);
  const allWards = await request('/api/admin/wards?includeInactive=true');
  assert.equal((await allWards.json()).items.some(ward => ward.id === wardId), true);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM ward_team_memberships WHERE removed_at IS NOT NULL').get().count, 2);
});

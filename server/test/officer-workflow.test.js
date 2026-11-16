import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-officer-workflow-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_PATH: path.join(tempDirectory, 'officer-workflow.sqlite'),
  JWT_SECRET: 'officer-workflow-test-secret-long-enough', CORS_ORIGINS: 'http://localhost:3000',
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-key',
  GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.5-flash-lite'
});

const { db, closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
migrateDatabase(db);
const { createOfficerRouter } = await import('../src/modules/officer/officer.routes.js');
const { reassignIssueTeam, unassignIssueTeam } = await import('../src/modules/admin/team-assignment.service.js');

const uploaded = new Map();
let uploadNumber = 0;
const fakeStorage = {
  async uploadRepairEvidenceImage(file) {
    const key = `repair-evidence/test-${++uploadNumber}.png`;
    uploaded.set(key, Buffer.from(file.buffer));
    return key;
  },
  async deleteRepairEvidenceObject(key) { uploaded.delete(key); },
  async createRepairEvidenceReadUrl(key) { return `https://private.test/${encodeURIComponent(key)}`; }
};
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/officer', createOfficerRouter(fakeStorage));

let server;
let baseUrl;
let ids;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=', 'base64');

function addUser(id, role) {
  db.prepare(`INSERT INTO users(id,display_name,email,password_hash,role) VALUES(?,?,?,'hash',?)`)
    .run(id, `Workflow User ${id}`, `workflow-${id}@example.test`, role);
}
function token(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, { algorithm: 'HS256', subject: String(userId),
    issuer: 'civicpulse-api', audience: 'civicpulse-client' });
}
async function request(pathname, { userId = 3, method = 'GET', body, multipart = false } = {}) {
  const headers = { cookie: `civicpulse_token=${token(userId)}` };
  if (body !== undefined && !multipart) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, { method, headers,
    ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }) });
}
function createIssue(teamId = ids.team) {
  const issueId = Number(db.prepare('INSERT INTO civic_issues DEFAULT VALUES').run().lastInsertRowid);
  db.prepare(`UPDATE civic_issues SET assigned_team_id=?,routing_department='Roads & Infrastructure' WHERE id=?`).run(teamId, issueId);
  const event = db.prepare(`INSERT INTO civic_issue_team_assignment_events
    (civic_issue_id,event_type,team_id,approved_department,admin_user_id)
    VALUES(?,'ASSIGNED',?,'Roads & Infrastructure',1)`).run(issueId, teamId);
  return { issueId, assignmentEventId: Number(event.lastInsertRowid) };
}
async function upload(issueId, stage, userId = 3) {
  const form = new FormData();
  form.set('stage', stage);
  form.set('photo', new Blob([png], { type: 'image/png' }), 'repair.png');
  return request(`/api/officer/civic-issues/${issueId}/repair-evidence`, { userId, method: 'POST', body: form, multipart: true });
}

before(async () => {
  addUser(1, 'ADMIN'); addUser(2, 'CITIZEN'); addUser(3, 'OFFICER'); addUser(4, 'OFFICER'); addUser(5, 'OFFICER');
  ids = {};
  ids.ward = Number(db.prepare("INSERT INTO wards(code,name) VALUES('TEST','Test Ward')").run().lastInsertRowid);
  ids.team = Number(db.prepare("INSERT INTO ward_teams(ward_id,name,department) VALUES(?,'Road Team','Roads & Infrastructure')").run(ids.ward).lastInsertRowid);
  ids.otherTeam = Number(db.prepare("INSERT INTO ward_teams(ward_id,name,department) VALUES(?,'Other Road Team','Roads & Infrastructure')").run(ids.ward).lastInsertRowid);
  db.prepare('INSERT INTO ward_team_memberships(team_id,officer_user_id,added_by_admin_id) VALUES(?,3,1)').run(ids.team);
  db.prepare('INSERT INTO ward_team_memberships(team_id,officer_user_id,added_by_admin_id) VALUES(?,5,1)').run(ids.team);
  db.prepare('INSERT INTO ward_team_memberships(team_id,officer_user_id,added_by_admin_id) VALUES(?,4,1)').run(ids.otherTeam);
  ids.issue = createIssue();
  ids.unassignedIssue = Number(db.prepare('INSERT INTO civic_issues DEFAULT VALUES').run().lastInsertRowid);
  ids.secondIssue = createIssue();
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('officer APIs enforce role and active team membership without exposing complaint data or coordinates', async () => {
  db.prepare(`INSERT INTO complaints(user_id,civic_issue_id,title,description,latitude,longitude)
    VALUES(2,?,'Citizen secret title','Private complaint description sentinel',23.123456,72.654321)`).run(ids.issue.issueId);
  assert.equal((await request('/api/officer/civic-issues', { userId: 2 })).status, 403);
  assert.equal((await request('/api/officer/civic-issues', { userId: 1 })).status, 403);
  assert.equal((await request(`/api/officer/civic-issues/${ids.issue.issueId}`, { userId: 4 })).status, 404);
  const response = await request('/api/officer/civic-issues');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.items.length, 2);
  const serialized = JSON.stringify(result);
  for (const field of ['description', 'latitude', 'longitude', 'userId', 'citizen']) assert.equal(serialized.includes(field), false);
  for (const privateValue of ['Private complaint description sentinel', 'Citizen secret title', '23.123456', '72.654321']) {
    assert.equal(serialized.includes(privateValue), false);
  }
  const storedBefore = uploaded.size;
  assert.equal((await upload(ids.issue.issueId, 'BEFORE', 2)).status, 403);
  assert.equal(uploaded.size, storedBefore);
  assert.equal((await upload(ids.issue.issueId, 'NOPE')).status, 400);
  assert.equal(uploaded.size, storedBefore);
});

test('work starts once and assignment changes are blocked during IN_PROGRESS', async () => {
  const started = await request(`/api/officer/civic-issues/${ids.issue.issueId}/start`, { method: 'POST', body: {} });
  assert.equal(started.status, 200);
  assert.equal((await started.json()).event.status, 'IN_PROGRESS');
  assert.equal((await request(`/api/officer/civic-issues/${ids.issue.issueId}/start`, { method: 'POST', body: {} })).status, 409);
  assert.throws(() => reassignIssueTeam(ids.issue.issueId, ids.otherTeam, 'Roads & Infrastructure', 1), { status: 409 });
  assert.throws(() => unassignIssueTeam(ids.issue.issueId, 1), { status: 409 });
  assert.throws(() => db.prepare(`UPDATE civic_issues SET assigned_team_id=? WHERE id=?`).run(ids.otherTeam, ids.issue.issueId), /team assignment cannot change/);
  assert.throws(() => db.prepare(`UPDATE civic_issues SET assigned_team_id=NULL,routing_department=NULL WHERE id=?`).run(ids.issue.issueId), /team assignment cannot change/);
  assert.equal(db.prepare('SELECT assigned_team_id FROM civic_issues WHERE id=?').get(ids.issue.issueId).assigned_team_id, ids.team);
});

test('BEFORE evidence is allowed before or during work; AFTER evidence only during work; evidence records bind to assignment events', async () => {
  const beforeIssue = ids.secondIssue.issueId;
  const before = await upload(beforeIssue, 'BEFORE');
  assert.equal(before.status, 201);
  const beforeEvidence = (await before.json()).evidence;
  const boundBefore = db.prepare('SELECT assignment_event_id,team_id,uploaded_by_officer_id FROM civic_issue_repair_evidence WHERE id=?').get(beforeEvidence.id);
  assert.deepEqual(boundBefore, { assignment_event_id: ids.secondIssue.assignmentEventId, team_id: ids.team, uploaded_by_officer_id: 3 });
  assert.equal((await upload(beforeIssue, 'AFTER')).status, 409);
  assert.equal((await request(`/api/officer/civic-issues/${beforeIssue}/start`, { method: 'POST', body: {} })).status, 200);
  assert.equal((await upload(beforeIssue, 'BEFORE')).status, 201);
  assert.equal((await upload(beforeIssue, 'AFTER')).status, 201);
  const listed = await (await request(`/api/officer/civic-issues/${beforeIssue}/repair-evidence`)).json();
  assert.equal(listed.items.length, 3);
  assert.ok(listed.items.every(item => item.url.startsWith('https://private.test/')));
  assert.equal(JSON.stringify(listed).includes('objectKey'), false);
});

test('completion requires both stages, then conditionally resolves and records history', async () => {
  const issueId = ids.unassignedIssue;
  assert.equal((await request(`/api/officer/civic-issues/${issueId}/complete`, { method: 'POST', body: {} })).status, 404);
  const noEvidenceIssue = createIssue().issueId;
  await request(`/api/officer/civic-issues/${noEvidenceIssue}/start`, { method: 'POST', body: {} });
  assert.equal((await request(`/api/officer/civic-issues/${noEvidenceIssue}/complete`, { method: 'POST', body: {} })).status, 409);
  const afterOnlyIssue = createIssue().issueId;
  await request(`/api/officer/civic-issues/${afterOnlyIssue}/start`, { method: 'POST', body: {} });
  assert.equal((await upload(afterOnlyIssue, 'AFTER')).status, 201);
  const missingBefore = await request(`/api/officer/civic-issues/${afterOnlyIssue}/complete`, { method: 'POST', body: {} });
  assert.equal(missingBefore.status, 409);

  const completeIssue = createIssue().issueId;
  await upload(completeIssue, 'BEFORE');
  await request(`/api/officer/civic-issues/${completeIssue}/start`, { method: 'POST', body: {} });
  await upload(completeIssue, 'AFTER');
  const completed = await request(`/api/officer/civic-issues/${completeIssue}/complete`, { method: 'POST', body: {} });
  assert.equal(completed.status, 200);
  assert.equal((await completed.json()).event.status, 'RESOLVED');
  assert.equal(db.prepare('SELECT status FROM civic_issues WHERE id=?').get(completeIssue).status, 'RESOLVED');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM civic_issue_work_events WHERE civic_issue_id=? AND event_type='COMPLETED'").get(completeIssue).count, 1);
  assert.equal((await request(`/api/officer/civic-issues/${completeIssue}/complete`, { method: 'POST', body: {} })).status, 409);
});

test('failed start, evidence persistence, and completion transactions leave no partial state', async () => {
  const startIssue = createIssue().issueId;
  db.exec(`CREATE TRIGGER fail_start_audit BEFORE INSERT ON civic_issue_work_events
    WHEN NEW.civic_issue_id=${startIssue} AND NEW.event_type='STARTED' BEGIN SELECT RAISE(ABORT,'forced'); END`);
  assert.equal((await request(`/api/officer/civic-issues/${startIssue}/start`, { method: 'POST', body: {} })).status, 500);
  assert.equal(db.prepare('SELECT status FROM civic_issues WHERE id=?').get(startIssue).status, 'OPEN');
  db.exec('DROP TRIGGER fail_start_audit');

  const evidenceIssue = createIssue().issueId;
  const previousUploadCount = uploaded.size;
  db.exec(`CREATE TRIGGER fail_evidence_audit BEFORE INSERT ON civic_issue_work_events
    WHEN NEW.civic_issue_id=${evidenceIssue} AND NEW.event_type='EVIDENCE_UPLOADED' BEGIN SELECT RAISE(ABORT,'forced'); END`);
  assert.equal((await upload(evidenceIssue, 'BEFORE')).status, 500);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_repair_evidence WHERE civic_issue_id=?').get(evidenceIssue).count, 0);
  assert.equal(uploaded.size, previousUploadCount);
  db.exec('DROP TRIGGER fail_evidence_audit');

  const completeIssue = createIssue().issueId;
  await upload(completeIssue, 'BEFORE');
  await request(`/api/officer/civic-issues/${completeIssue}/start`, { method: 'POST', body: {} });
  await upload(completeIssue, 'AFTER');
  db.exec(`CREATE TRIGGER fail_complete_audit BEFORE INSERT ON civic_issue_work_events
    WHEN NEW.civic_issue_id=${completeIssue} AND NEW.event_type='COMPLETED' BEGIN SELECT RAISE(ABORT,'forced'); END`);
  assert.equal((await request(`/api/officer/civic-issues/${completeIssue}/complete`, { method: 'POST', body: {} })).status, 500);
  assert.equal(db.prepare('SELECT status FROM civic_issues WHERE id=?').get(completeIssue).status, 'IN_PROGRESS');
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM civic_issue_work_events WHERE civic_issue_id=? AND event_type='COMPLETED'").get(completeIssue).count, 0);
  db.exec('DROP TRIGGER fail_complete_audit');
});

test('removed team members lose access; admin issue detail retains evidence and work audit', async () => {
  const issueId = createIssue().issueId;
  await upload(issueId, 'BEFORE');
  db.prepare(`UPDATE ward_team_memberships SET removed_by_admin_id=1,removed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE team_id=? AND officer_user_id=3 AND removed_at IS NULL`).run(ids.team);
  assert.equal((await request(`/api/officer/civic-issues/${issueId}`)).status, 404);
  db.prepare(`INSERT INTO ward_team_memberships(team_id,officer_user_id,added_by_admin_id) VALUES(?,3,1)`).run(ids.team);
  const { getCivicIssue } = await import('../src/modules/admin/admin.service.js');
  const detail = getCivicIssue(issueId);
  assert.equal(detail.repairEvidence.length, 1);
  assert.equal(detail.repairEvidence[0].assignmentEventId, db.prepare('SELECT id FROM civic_issue_team_assignment_events WHERE civic_issue_id=?').get(issueId).id);
  assert.ok(Array.isArray(detail.workHistory));
});

test('evidence and workflow audit tables reject edits and deletes', async () => {
  const issueId = createIssue().issueId;
  const uploadedResponse = await upload(issueId, 'BEFORE');
  assert.equal(uploadedResponse.status, 201);
  const evidenceId = db.prepare('SELECT id FROM civic_issue_repair_evidence WHERE civic_issue_id=?').get(issueId).id;
  const eventId = db.prepare("SELECT id FROM civic_issue_work_events WHERE civic_issue_id=? AND event_type='EVIDENCE_UPLOADED'").get(issueId).id;
  assert.throws(() => db.prepare("UPDATE civic_issue_repair_evidence SET stage='AFTER' WHERE id=?").run(evidenceId), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM civic_issue_repair_evidence WHERE id=?').run(evidenceId));
  assert.throws(() => db.prepare("UPDATE civic_issue_work_events SET event_type='STARTED' WHERE id=?").run(eventId), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM civic_issue_work_events WHERE id=?').run(eventId), /append-only/);
});

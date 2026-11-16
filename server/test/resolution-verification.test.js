import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-resolution-verification-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_PATH: path.join(tempDirectory, 'resolution.sqlite'),
  JWT_SECRET: 'resolution-verification-test-secret-long', CORS_ORIGINS: 'http://localhost:3000',
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-key',
  GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.5-flash-lite'
});

const { db, closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
migrateDatabase(db);
const { createComplaintRouter } = await import('../src/modules/complaints/complaint.routes.js');
const { createAdminRouter } = await import('../src/modules/admin/admin.routes.js');
const { errorHandler, notFound } = await import('../src/middleware/errorHandler.js');

const stored = new Set();
let objectNumber = 0;
const fakeStorage = {
  async createRepairEvidenceReadUrl(key) {
    assert.ok(key.startsWith('repair-evidence/'));
    return `https://private.test/${encodeURIComponent(key)}`;
  },
  async uploadRepairEvidenceImage() { const key = `repair-evidence/fake-${++objectNumber}.jpg`; stored.add(key); return key; },
  async deleteRepairEvidenceObject(key) { stored.delete(key); }
};
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/complaints', createComplaintRouter(fakeStorage));
app.use('/api/admin', createAdminRouter(fakeStorage));
app.use(notFound);
app.use(errorHandler);

let server;
let baseUrl;
let ids;

function addUser(id, role, displayName = `Resolution User ${id}`) {
  db.prepare(`INSERT INTO users(id,display_name,email,password_hash,role) VALUES(?,?,?,'hash',?)`)
    .run(id, displayName, `resolution-${id}@example.test`, role);
}
function token(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, { algorithm: 'HS256', subject: String(userId),
    issuer: 'civicpulse-api', audience: 'civicpulse-client' });
}
async function request(pathname, { userId = 2, method = 'GET', body } = {}) {
  const headers = { cookie: `civicpulse_token=${token(userId)}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function createComplaint(userId, issueId, { title = 'Private citizen title', description = 'Private complaint description', latitude = 22.123456, longitude = 71.654321 } = {}) {
  return Number(db.prepare(`INSERT INTO complaints(user_id,civic_issue_id,title,description,latitude,longitude)
    VALUES(?,?,?,?,?,?)`).run(userId, issueId, title, description, latitude, longitude).lastInsertRowid);
}
function createResolvedTeamIssue() {
  const issueId = Number(db.prepare('INSERT INTO civic_issues DEFAULT VALUES').run().lastInsertRowid);
  const complaint1 = createComplaint(2, issueId, { title: 'CITIZEN_ONE_SECRET_TITLE', description: 'CITIZEN_ONE_PRIVATE_DESCRIPTION' });
  const complaint1b = createComplaint(2, issueId, { title: 'CITIZEN_ONE_SECOND_TITLE', description: 'SECOND_PRIVATE_DESCRIPTION' });
  const complaint2 = createComplaint(3, issueId, { title: 'CITIZEN_TWO_SECRET_TITLE', description: 'CITIZEN_TWO_PRIVATE_DESCRIPTION' });
  db.prepare(`UPDATE civic_issues SET assigned_team_id=?,routing_department='Roads & Infrastructure' WHERE id=?`).run(ids.team, issueId);
  const assignment = db.prepare(`INSERT INTO civic_issue_team_assignment_events
    (civic_issue_id,event_type,team_id,approved_department,admin_user_id)
    VALUES(?,'ASSIGNED',?,'Roads & Infrastructure',1)`).run(issueId, ids.team);
  const assignmentEventId = Number(assignment.lastInsertRowid);
  const insertEvidence = db.prepare(`INSERT INTO civic_issue_repair_evidence
    (civic_issue_id,team_id,assignment_event_id,uploaded_by_officer_id,stage,object_key,mime_type,byte_size)
    VALUES(?,?,?,4,?,?, 'image/jpeg',100)`);
  insertEvidence.run(issueId, ids.team, assignmentEventId, 'BEFORE', `repair-evidence/${issueId}-before.jpg`);
  db.prepare("UPDATE civic_issues SET status='IN_PROGRESS' WHERE id=?").run(issueId);
  insertEvidence.run(issueId, ids.team, assignmentEventId, 'AFTER', `repair-evidence/${issueId}-after.jpg`);
  db.prepare("UPDATE civic_issues SET status='RESOLVED' WHERE id=?").run(issueId);
  db.prepare(`INSERT INTO civic_issue_work_events
    (civic_issue_id,event_type,team_id,assignment_event_id,officer_user_id,status_before,status_after)
    VALUES(?,'COMPLETED',?,?,4,'IN_PROGRESS','RESOLVED')`).run(issueId, ids.team, assignmentEventId);
  return { issueId, complaint1, complaint1b, complaint2, assignmentEventId };
}
function createUnassignedResolvedIssue(userId = 2) {
  const issueId = Number(db.prepare("INSERT INTO civic_issues(status) VALUES('RESOLVED')").run().lastInsertRowid);
  const complaintId = createComplaint(userId, issueId);
  return { issueId, complaintId };
}

before(async () => {
  addUser(1, 'ADMIN', 'Test Administrator');
  addUser(2, 'CITIZEN', 'Citizen Secret One');
  addUser(3, 'CITIZEN', 'Citizen Secret Two');
  addUser(4, 'OFFICER', 'Officer Test');
  addUser(5, 'ADMIN', 'Second Test Administrator');
  ids = {};
  ids.ward = Number(db.prepare("INSERT INTO wards(code,name) VALUES('VERIFY','Verification Ward')").run().lastInsertRowid);
  ids.team = Number(db.prepare(`INSERT INTO ward_teams(ward_id,name,department)
    VALUES(?,'Verification Roads Team','Roads & Infrastructure')`).run(ids.ward).lastInsertRowid);
  db.prepare(`INSERT INTO ward_team_memberships(team_id,officer_user_id,added_by_admin_id) VALUES(?,?,1)`)
    .run(ids.team, 4);
  ids.resolved = createResolvedTeamIssue();
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('citizen resolution access is complaint-owned, signed, and private across reporters', async () => {
  assert.equal((await request(`/api/complaints/${ids.resolved.complaint2}/resolution`)).status, 404);
  assert.equal((await request(`/api/complaints/${ids.resolved.complaint1}/resolution`, { userId: 4 })).status, 403);
  const response = await request(`/api/complaints/${ids.resolved.complaint1}/resolution`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.resolution.issue.id, ids.resolved.issueId);
  assert.equal(payload.resolution.evidence.length, 2);
  assert.ok(payload.resolution.evidence.every(item => item.url.startsWith('https://private.test/')));
  assert.equal(payload.resolution.myVerification, null);
  const serialized = JSON.stringify(payload);
  for (const privateValue of ['Citizen Secret One', 'Citizen Secret Two', 'CITIZEN_ONE_SECRET_TITLE',
    'CITIZEN_TWO_PRIVATE_DESCRIPTION', '22.123456', '71.654321', 'object_key', 'complaint_id']) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test('one citizen can submit one immutable response per civic issue across multiple owned complaints', async () => {
  const first = await request(`/api/complaints/${ids.resolved.complaint1}/resolution-verification`, {
    method: 'POST', body: { decision: 'DISPUTE', reason: 'The blocked lane is still not usable.' }
  });
  assert.equal(first.status, 201);
  assert.equal((await first.json()).verification.decision, 'DISPUTE');
  assert.equal((await request(`/api/complaints/${ids.resolved.complaint1b}/resolution-verification`, {
    method: 'POST', body: { decision: 'CONFIRM' }
  })).status, 409);
  const secondCitizen = await request(`/api/complaints/${ids.resolved.complaint2}/resolution-verification`, {
    userId: 3, method: 'POST', body: { decision: 'CONFIRM' }
  });
  assert.equal(secondCitizen.status, 201);
  const privateView = await (await request(`/api/complaints/${ids.resolved.complaint2}/resolution`, { userId: 3 })).json();
  assert.deepEqual(privateView.resolution.myVerification.decision, 'CONFIRM');
  assert.equal(JSON.stringify(privateView).includes('The blocked lane is still not usable.'), false);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_resolution_verifications WHERE civic_issue_id=?')
    .get(ids.resolved.issueId).count, 2);
});

test('verification validation, non-resolved issues, and concurrent duplicate submissions are rejected safely', async () => {
  assert.equal((await request(`/api/complaints/${ids.resolved.complaint1b}/resolution-verification`, {
    userId: 3, method: 'POST', body: { decision: 'DISPUTE' }
  })).status, 400);
  assert.equal((await request(`/api/complaints/${ids.resolved.complaint1b}/resolution-verification`, {
    userId: 3, method: 'POST', body: { decision: 'OTHER', reason: 'No' }
  })).status, 400);
  const openIssue = Number(db.prepare("INSERT INTO civic_issues(status) VALUES('OPEN')").run().lastInsertRowid);
  const openComplaint = createComplaint(3, openIssue);
  assert.equal((await request(`/api/complaints/${openComplaint}/resolution-verification`, {
    userId: 3, method: 'POST', body: { decision: 'CONFIRM' }
  })).status, 409);
  const race = createUnassignedResolvedIssue(3);
  const attempts = await Promise.all([
    request(`/api/complaints/${race.complaintId}/resolution-verification`, { userId: 3, method: 'POST', body: { decision: 'CONFIRM' } }),
    request(`/api/complaints/${race.complaintId}/resolution-verification`, { userId: 3, method: 'POST', body: { decision: 'DISPUTE', reason: 'Still broken.' } })
  ]);
  assert.equal(attempts.filter(response => response.status === 201).length, 1);
  assert.equal(attempts.filter(response => response.status === 409).length, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_resolution_verifications WHERE civic_issue_id=?')
    .get(race.issueId).count, 1);
});

test('admin dispute list aggregates votes; detail shows reasons and evidence without reporter or complaint data', async () => {
  assert.equal((await request('/api/admin/disputes', { userId: 2 })).status, 403);
  assert.equal((await request(`/api/admin/disputes/${ids.resolved.issueId}`, { userId: 4 })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/admin/disputes`)).status, 401);
  const list = await request('/api/admin/disputes', { userId: 1 });
  assert.equal(list.status, 200);
  const listPayload = await list.json();
  const item = listPayload.items.find(row => row.issueId === ids.resolved.issueId);
  assert.ok(item);
  assert.equal(item.disputeCount, 1);
  assert.equal(item.confirmationCount, 1);
  assert.equal(JSON.stringify(listPayload).includes('resolution-2@example.test'), false);

  const detailResponse = await request(`/api/admin/disputes/${ids.resolved.issueId}`, { userId: 1 });
  assert.equal(detailResponse.status, 200);
  const detail = JSON.stringify(await detailResponse.json());
  assert.match(detail, /The blocked lane is still not usable\./);
  assert.match(detail, /https:\/\/private\.test/);
  for (const privateValue of ['Citizen Secret One', 'Citizen Secret Two', 'resolution-2@example.test',
    'CITIZEN_ONE_SECRET_TITLE', 'CITIZEN_TWO_PRIVATE_DESCRIPTION', '22.123456', '71.654321', 'complaint_id']) {
    assert.equal(detail.includes(privateValue), false);
  }
});

test('reject keeps RESOLVED assignment and is final; citizens and officers cannot make admin decisions', async () => {
  const issue = createResolvedTeamIssue();
  await request(`/api/complaints/${issue.complaint1}/resolution-verification`, {
    method: 'POST', body: { decision: 'DISPUTE', reason: 'Repair is incomplete.' }
  });
  const route = `/api/admin/disputes/${issue.issueId}/review`;
  assert.equal((await request(route, { userId: 2, method: 'POST', body: { decision: 'ACCEPT', reason: 'Review' } })).status, 403);
  assert.equal((await request(route, { userId: 4, method: 'POST', body: { decision: 'ACCEPT', reason: 'Review' } })).status, 403);
  const invalid = await request(route, { userId: 1, method: 'POST', body: { decision: 'REJECT', reason: ' ' } });
  assert.equal(invalid.status, 400);
  const rejected = await request(route, { userId: 1, method: 'POST', body: { decision: 'REJECT', reason: 'Evidence confirms the work was completed.' } });
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).review.issueStatus, 'RESOLVED');
  assert.equal(db.prepare('SELECT status,assigned_team_id FROM civic_issues WHERE id=?').get(issue.issueId).status, 'RESOLVED');
  assert.equal(db.prepare('SELECT assigned_team_id FROM civic_issues WHERE id=?').get(issue.issueId).assigned_team_id, ids.team);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_team_assignment_events WHERE civic_issue_id=? AND event_type=\'UNASSIGNED\'').get(issue.issueId).count, 0);
  assert.equal((await request(`/api/complaints/${issue.complaint1b}/resolution-verification`, {
    method: 'POST', body: { decision: 'CONFIRM' }
  })).status, 409);
  assert.equal((await request(route, { userId: 1, method: 'POST', body: { decision: 'ACCEPT', reason: 'Second decision' } })).status, 409);
});

test('accept reopens, unassigns transactionally, and preserves assignment and repair history', async () => {
  const issue = createResolvedTeamIssue();
  await request(`/api/complaints/${issue.complaint1}/resolution-verification`, {
    method: 'POST', body: { decision: 'DISPUTE', reason: 'The repair did not hold.' }
  });
  const beforeEvents = db.prepare('SELECT COUNT(*) AS count FROM civic_issue_team_assignment_events WHERE civic_issue_id=?').get(issue.issueId).count;
  const response = await request(`/api/admin/disputes/${issue.issueId}/review`, {
    userId: 1, method: 'POST', body: { decision: 'ACCEPT', reason: 'The evidence does not show a durable repair.' }
  });
  assert.equal(response.status, 200);
  const review = (await response.json()).review;
  assert.equal(review.decision, 'ACCEPTED');
  assert.equal(review.issueStatus, 'OPEN');
  const current = db.prepare('SELECT status,assigned_team_id,routing_department,assigned_officer_id FROM civic_issues WHERE id=?').get(issue.issueId);
  assert.deepEqual(current, { status: 'OPEN', assigned_team_id: null, routing_department: null, assigned_officer_id: null });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_team_assignment_events WHERE civic_issue_id=?').get(issue.issueId).count, beforeEvents + 1);
  const unassignment = db.prepare('SELECT id,event_type,previous_team_id,team_id,admin_user_id FROM civic_issue_team_assignment_events WHERE id=?').get(review.teamUnassignmentEventId);
  assert.deepEqual(unassignment, { id: review.teamUnassignmentEventId, event_type: 'UNASSIGNED', previous_team_id: ids.team, team_id: null, admin_user_id: 1 });
  const storedReview = db.prepare('SELECT unassigned_team_event_id,previous_team_id,status_before,status_after FROM civic_issue_dispute_reviews WHERE civic_issue_id=?').get(issue.issueId);
  assert.deepEqual(storedReview, { unassigned_team_event_id: review.teamUnassignmentEventId, previous_team_id: ids.team, status_before: 'RESOLVED', status_after: 'OPEN' });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_repair_evidence WHERE civic_issue_id=?').get(issue.issueId).count, 2);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_team_assignment_events WHERE civic_issue_id=? AND event_type=\'ASSIGNED\'').get(issue.issueId).count, 1);
  assert.equal((await request(`/api/complaints/${issue.complaint1b}/resolution-verification`, {
    method: 'POST', body: { decision: 'CONFIRM' }
  })).status, 409);
  const { assignIssueToTeam } = await import('../src/modules/admin/team-assignment.service.js');
  const newAssignment = assignIssueToTeam(issue.issueId, ids.team, 'Roads & Infrastructure', 1);
  assert.notEqual(newAssignment.id, issue.assignmentEventId);
  const { createOfficerService } = await import('../src/modules/officer/officer.service.js');
  const officerService = createOfficerService(fakeStorage);
  officerService.startWork(issue.issueId, 4);
  assert.throws(() => officerService.completeWork(issue.issueId, 4), { status: 409 });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_repair_evidence WHERE civic_issue_id=? AND assignment_event_id=?')
    .get(issue.issueId, newAssignment.id).count, 0);
});

test('accepting a legacy individual assignment appends its existing UNASSIGNED history event', async () => {
  const issueId = Number(db.prepare("INSERT INTO civic_issues(status) VALUES('RESOLVED')").run().lastInsertRowid);
  const complaintId = createComplaint(2, issueId);
  db.exec('DROP TRIGGER civic_issue_individual_assignment_deprecated');
  db.prepare('UPDATE civic_issues SET assigned_officer_id=4 WHERE id=?').run(issueId);
  db.prepare(`INSERT INTO civic_issue_assignment_events(civic_issue_id,event_type,previous_officer_id,officer_id,admin_user_id)
    VALUES(?,'ASSIGNED',NULL,4,1)`).run(issueId);
  db.exec(`CREATE TRIGGER civic_issue_individual_assignment_deprecated BEFORE UPDATE OF assigned_officer_id ON civic_issues
    WHEN NEW.assigned_officer_id IS NOT NULL AND NEW.assigned_officer_id IS NOT OLD.assigned_officer_id
    BEGIN SELECT RAISE(ABORT,'new individual assignments are disabled'); END`);
  await request(`/api/complaints/${complaintId}/resolution-verification`, {
    method: 'POST', body: { decision: 'DISPUTE', reason: 'The issue is ongoing.' }
  });
  const response = await request(`/api/admin/disputes/${issueId}/review`, {
    userId: 1, method: 'POST', body: { decision: 'ACCEPT', reason: 'The issue remains unresolved.' }
  });
  assert.equal(response.status, 200);
  const review = (await response.json()).review;
  assert.ok(review.individualUnassignmentEventId > 0);
  assert.deepEqual(db.prepare('SELECT status,assigned_officer_id FROM civic_issues WHERE id=?').get(issueId), { status: 'OPEN', assigned_officer_id: null });
  assert.deepEqual(db.prepare('SELECT event_type,previous_officer_id,officer_id,admin_user_id FROM civic_issue_assignment_events WHERE id=?').get(review.individualUnassignmentEventId), {
    event_type: 'UNASSIGNED', previous_officer_id: 4, officer_id: null, admin_user_id: 1
  });
});

test('dispute review trigger requires referenced team and legacy unassignment events to share its admin', async () => {
  const teamIssue = createResolvedTeamIssue();
  await request(`/api/complaints/${teamIssue.complaint1}/resolution-verification`, {
    method: 'POST', body: { decision: 'DISPUTE', reason: 'The repair is incomplete.' }
  });
  db.prepare(`UPDATE civic_issues SET status='OPEN',assigned_team_id=NULL,routing_department=NULL WHERE id=?`)
    .run(teamIssue.issueId);
  const teamEventId = Number(db.prepare(`INSERT INTO civic_issue_team_assignment_events
    (civic_issue_id,event_type,previous_team_id,team_id,approved_department,admin_user_id)
    VALUES(?,'UNASSIGNED',?,NULL,'Roads & Infrastructure',5)`).run(teamIssue.issueId, ids.team).lastInsertRowid);
  assert.throws(() => db.prepare(`INSERT INTO civic_issue_dispute_reviews
    (civic_issue_id,decision,reason,admin_user_id,previous_team_id,unassigned_team_event_id,status_before,status_after)
    VALUES(?,'ACCEPTED','Reviewed dispute.',1,?,?,'RESOLVED','OPEN')`)
    .run(teamIssue.issueId, ids.team, teamEventId), /invalid admin dispute review/);

  const officerIssueId = Number(db.prepare("INSERT INTO civic_issues(status) VALUES('RESOLVED')").run().lastInsertRowid);
  const officerComplaintId = createComplaint(2, officerIssueId);
  db.exec('DROP TRIGGER civic_issue_individual_assignment_deprecated');
  db.prepare('UPDATE civic_issues SET assigned_officer_id=4 WHERE id=?').run(officerIssueId);
  db.prepare(`INSERT INTO civic_issue_assignment_events
    (civic_issue_id,event_type,previous_officer_id,officer_id,admin_user_id)
    VALUES(?,'ASSIGNED',NULL,4,1)`).run(officerIssueId);
  db.exec(`CREATE TRIGGER civic_issue_individual_assignment_deprecated BEFORE UPDATE OF assigned_officer_id ON civic_issues
    WHEN NEW.assigned_officer_id IS NOT NULL AND NEW.assigned_officer_id IS NOT OLD.assigned_officer_id
    BEGIN SELECT RAISE(ABORT,'new individual assignments are disabled'); END`);
  await request(`/api/complaints/${officerComplaintId}/resolution-verification`, {
    method: 'POST', body: { decision: 'DISPUTE', reason: 'The issue remains unresolved.' }
  });
  db.prepare('UPDATE civic_issues SET status=\'OPEN\',assigned_officer_id=NULL WHERE id=?').run(officerIssueId);
  const officerEventId = Number(db.prepare(`INSERT INTO civic_issue_assignment_events
    (civic_issue_id,event_type,previous_officer_id,officer_id,admin_user_id)
    VALUES(?,'UNASSIGNED',4,NULL,5)`).run(officerIssueId).lastInsertRowid);
  assert.throws(() => db.prepare(`INSERT INTO civic_issue_dispute_reviews
    (civic_issue_id,decision,reason,admin_user_id,previous_officer_id,unassigned_officer_event_id,status_before,status_after)
    VALUES(?,'ACCEPTED','Reviewed dispute.',1,4,?,'RESOLVED','OPEN')`)
    .run(officerIssueId, officerEventId), /invalid admin dispute review/);
});

test('failed acceptance rolls back status, assignments, assignment events, and review record', async () => {
  const issue = createResolvedTeamIssue();
  await request(`/api/complaints/${issue.complaint1}/resolution-verification`, {
    method: 'POST', body: { decision: 'DISPUTE', reason: 'Repair has failed.' }
  });
  const beforeEventCount = db.prepare('SELECT COUNT(*) AS count FROM civic_issue_team_assignment_events WHERE civic_issue_id=?').get(issue.issueId).count;
  db.exec(`CREATE TRIGGER fail_dispute_review BEFORE INSERT ON civic_issue_dispute_reviews
    WHEN NEW.civic_issue_id=${issue.issueId} BEGIN SELECT RAISE(ABORT,'forced review failure'); END`);
  assert.equal((await request(`/api/admin/disputes/${issue.issueId}/review`, {
    userId: 1, method: 'POST', body: { decision: 'ACCEPT', reason: 'Accept dispute.' }
  })).status, 500);
  assert.deepEqual(db.prepare('SELECT status,assigned_team_id,routing_department FROM civic_issues WHERE id=?').get(issue.issueId), {
    status: 'RESOLVED', assigned_team_id: ids.team, routing_department: 'Roads & Infrastructure'
  });
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_team_assignment_events WHERE civic_issue_id=?').get(issue.issueId).count, beforeEventCount);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_dispute_reviews WHERE civic_issue_id=?').get(issue.issueId).count, 0);
  db.exec('DROP TRIGGER fail_dispute_review');
});

test('concurrent admin reviews commit exactly one final decision', async () => {
  const issue = createResolvedTeamIssue();
  await request(`/api/complaints/${issue.complaint1}/resolution-verification`, {
    method: 'POST', body: { decision: 'DISPUTE', reason: 'Still needs repair.' }
  });
  const path = `/api/admin/disputes/${issue.issueId}/review`;
  const results = await Promise.all([
    request(path, { userId: 1, method: 'POST', body: { decision: 'ACCEPT', reason: 'Agree with dispute.' } }),
    request(path, { userId: 1, method: 'POST', body: { decision: 'REJECT', reason: 'Dispute is not supported.' } })
  ]);
  assert.equal(results.filter(response => response.status === 200).length, 1);
  assert.equal(results.filter(response => response.status === 409).length, 1);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_dispute_reviews WHERE civic_issue_id=?').get(issue.issueId).count, 1);
});

test('review audit and citizen verification records are append-only', async () => {
  const issue = createUnassignedResolvedIssue();
  const submitted = await request(`/api/complaints/${issue.complaintId}/resolution-verification`, {
    method: 'POST', body: { decision: 'DISPUTE', reason: 'Not resolved.' }
  });
  assert.equal(submitted.status, 201);
  const verificationId = db.prepare('SELECT id FROM civic_issue_resolution_verifications WHERE civic_issue_id=?').get(issue.issueId).id;
  assert.throws(() => db.prepare("UPDATE civic_issue_resolution_verifications SET decision='CONFIRM' WHERE id=?").run(verificationId), /immutable/);
  assert.throws(() => db.prepare('DELETE FROM civic_issue_resolution_verifications WHERE id=?').run(verificationId), /cannot be deleted/);
  const reviewed = await request(`/api/admin/disputes/${issue.issueId}/review`, {
    userId: 1, method: 'POST', body: { decision: 'REJECT', reason: 'Review complete.' }
  });
  assert.equal(reviewed.status, 200);
  const reviewId = db.prepare('SELECT id FROM civic_issue_dispute_reviews WHERE civic_issue_id=?').get(issue.issueId).id;
  assert.throws(() => db.prepare("UPDATE civic_issue_dispute_reviews SET decision='ACCEPTED' WHERE id=?").run(reviewId), /final and immutable/);
  assert.throws(() => db.prepare('DELETE FROM civic_issue_dispute_reviews WHERE id=?').run(reviewId), /cannot be deleted/);
});

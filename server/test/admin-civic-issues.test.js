import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-admin-test-'));
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = path.join(tempDirectory, 'admin.sqlite');
process.env.JWT_SECRET = 'admin-test-secret-long-enough-for-validation';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key';
process.env.GEMINI_API_KEY = 'test-key';
process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';

const { db, closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
migrateDatabase(db);
const { default: app } = await import('../src/app.js');
const { createComplaintTransaction } = await import('../src/modules/complaints/complaint.service.js');

let server;
let baseUrl;
let issueId;
let mergedIssueId;
let adminToken;
let citizenToken;
let officerToken;

function addUser(id, role, name) {
  db.prepare(`INSERT INTO users (id, display_name, email, password_hash, role,email_verified)
    VALUES (?, ?, ?, 'test-hash', ?,?)`)
    .run(id, name, `${name.toLowerCase().replaceAll(' ', '.')}@example.test`, role,
      role === 'CITIZEN' ? 1 : 0);
}

function addComplaint(userId, civicIssueId, title, description) {
  return Number(db.prepare(`INSERT INTO complaints
    (user_id, civic_issue_id, title, description, latitude, longitude)
    VALUES (?, ?, ?, ?, 12.3, 45.6)`)
    .run(userId, civicIssueId, title, description).lastInsertRowid);
}

function addLegacyIndividualAssignment(targetIssueId, officerId = 3) {
  db.exec('DROP TRIGGER civic_issue_individual_assignment_deprecated');
  db.prepare('UPDATE civic_issues SET assigned_officer_id=? WHERE id=?').run(officerId, targetIssueId);
  db.prepare(`INSERT INTO civic_issue_assignment_events
    (civic_issue_id,event_type,previous_officer_id,officer_id,admin_user_id)
    VALUES(?,'ASSIGNED',NULL,?,1)`).run(targetIssueId, officerId);
  db.exec(`CREATE TRIGGER civic_issue_individual_assignment_deprecated
    BEFORE UPDATE OF assigned_officer_id ON civic_issues
    WHEN NEW.assigned_officer_id IS NOT NULL AND NEW.assigned_officer_id IS NOT OLD.assigned_officer_id
    BEGIN SELECT RAISE(ABORT,'new individual assignments are disabled; route to a ward team'); END`);
}

function tokenFor(userId) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    algorithm: 'HS256', subject: String(userId), issuer: 'civicpulse-api', audience: 'civicpulse-client'
  });
}

async function request(pathname, { userId, method = 'GET', body } = {}) {
  const headers = { cookie: `civicpulse_token=${tokenFor(userId)}` };
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

before(async () => {
  addUser(1, 'ADMIN', 'Civic Admin');
  addUser(2, 'CITIZEN', 'Citizen A');
  addUser(3, 'OFFICER', 'Officer A');
  addUser(4, 'OFFICER', 'Officer B');
  addUser(5, 'CITIZEN', 'Citizen B');
  adminToken = tokenFor(1);
  citizenToken = tokenFor(2);
  officerToken = tokenFor(3);

  issueId = Number(db.prepare('INSERT INTO civic_issues DEFAULT VALUES').run().lastInsertRowid);
  mergedIssueId = Number(db.prepare(`INSERT INTO civic_issues (status, merged_into_issue_id)
    VALUES ('MERGED', ?)`)
    .run(issueId).lastInsertRowid);
  const reportA = addComplaint(2, issueId, 'private title A', 'private description A');
  const reportB = addComplaint(5, issueId, 'private title B', 'private description B');
  db.prepare(`INSERT INTO complaint_ai_assessments
    (complaint_id, status, category, department, severity, severity_reason, risk_factors, confidence,
     human_review_required, human_review_reason, created_at)
    VALUES (?, 'SUCCEEDED', 'ROAD_DAMAGE', 'Roads & Infrastructure', 'MEDIUM', 'reason', '[]', .8, 0, '',
      '2026-11-16T12:00:00.000Z')`).run(reportA);
  db.prepare(`INSERT INTO complaint_ai_assessments
    (complaint_id, status, category, department, severity, severity_reason, risk_factors, confidence,
     human_review_required, human_review_reason, created_at)
    VALUES (?, 'SUCCEEDED', 'DRAINAGE', 'Drainage', 'HIGH', 'reason', '[]', .7, 1, 'review',
      '2026-11-16T12:01:00.000Z')`).run(reportB);
  db.prepare(`INSERT INTO complaint_ai_assessments
    (complaint_id, status, category, department, severity, severity_reason, risk_factors, confidence,
     human_review_required, human_review_reason, created_at)
    VALUES (?, 'SUCCEEDED', 'WASTE_MANAGEMENT', 'Sanitation', 'CRITICAL', 'historical', '[]', .5, 1,
      'historical review', '2000-01-01T00:00:00.000Z')`).run(reportA);

  const created = createComplaintTransaction({
    userId: 2,
    fields: { title: 'New complaint', description: 'A newly reported issue.', latitude: 1, longitude: 2 },
    file: { verifiedMimeType: 'image/jpeg', size: 100 },
    objectKey: 'complaints/test-photo.jpg'
  });
  assert.ok(created.complaint.civic_issue_id > 0);
  assert.equal(created.complaint.issue_report_count, 1);
  assert.equal(db.prepare('SELECT status FROM complaint_ai_assessments WHERE complaint_id = ?').get(created.complaint.id).status, 'PENDING');

  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

test('admin list paginates, excludes merged issues by default, filters merged issues, and derives counts', async () => {
  const response = await request('/api/admin/civic-issues?limit=1&offset=0', { userId: 1 });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.items.length, 1);
  assert.equal(result.pagination.limit, 1);
  assert.equal(result.pagination.hasMore, true);
  assert.ok(result.items.every((issue) => issue.status !== 'MERGED'));
  const issue = result.items.find((item) => item.id === issueId) ??
    (await (await request('/api/admin/civic-issues?limit=50', { userId: 1 })).json()).items.find((item) => item.id === issueId);
  assert.equal(issue.reportCount, 2);
  assert.equal(issue.aiAssessmentSummary.assessedReportCount, 2);
  assert.equal(issue.aiAssessmentSummary.latestSuccessfulComplaintAssessment.severity, 'HIGH');
  assert.deepEqual(issue.aiAssessmentSummary.severityCounts.map((item) => item.severity).sort(), ['HIGH', 'MEDIUM']);

  const mergedResponse = await request('/api/admin/civic-issues?status=MERGED', { userId: 1 });
  const merged = await mergedResponse.json();
  assert.equal(merged.items.length, 1);
  assert.equal(merged.items[0].id, mergedIssueId);
  assert.equal(merged.items[0].canonicalIssueId, issueId);
});

test('admin issue details show canonical issue and safe report summaries, not citizen information', async () => {
  const response = await request(`/api/admin/civic-issues/${mergedIssueId}`, { userId: 1 });
  assert.equal(response.status, 200);
  const { issue } = await response.json();
  assert.equal(issue.canonicalIssue.id, issueId);
  assert.equal(issue.reportCount, 0);

  const activeResponse = await request(`/api/admin/civic-issues/${issueId}`, { userId: 1 });
  const { issue: activeIssue } = await activeResponse.json();
  assert.equal(activeIssue.reportCount, 2);
  assert.equal(activeIssue.linkedComplaints.length, 2);
  const safeJson = JSON.stringify(activeIssue.linkedComplaints);
  assert.doesNotMatch(safeJson, /Citizen A|Citizen B|example\.test|private title|private description|latitude|longitude|user_id/);
  assert.equal(activeIssue.assignmentHistory.length, 0);
});

test('citizens and officers are rejected from admin endpoints; citizens retain only owned complaints', async () => {
  for (const userId of [2, 3]) {
    const response = await request('/api/admin/civic-issues', { userId });
    assert.equal(response.status, 403);
    const assignment = await request(`/api/admin/civic-issues/${issueId}/assignments`, {
      userId, method: 'POST', body: { officerId: 3 }
    });
    assert.equal(assignment.status, 403);
  }

  const citizenListResponse = await request('/api/complaints', { userId: 2 });
  assert.equal(citizenListResponse.status, 200);
  const citizenList = await citizenListResponse.json();
  const ownedIds = citizenList.items.map((item) => item.id);
  assert.equal(ownedIds.includes(db.prepare('SELECT id FROM complaints WHERE user_id = 5').get().id), false);
  const ownReport = citizenList.items.find((item) => item.civicIssueId === issueId);
  assert.equal(ownReport.issueStatus, 'OPEN');
  assert.equal(ownReport.reportCount, 2);
});

test('new individual assignment and reassignment are blocked while legacy assignments remain readable and unassignable', async () => {
  const invalid = await request(`/api/admin/civic-issues/${issueId}/assignments`, {
    userId: 1, method: 'POST', body: { officerId: 2 }
  });
  assert.equal(invalid.status, 409);

  const assign = await request(`/api/admin/civic-issues/${issueId}/assignments`, {
    userId: 1, method: 'POST', body: { officerId: 3 }
  });
  assert.equal(assign.status, 409);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_assignment_events WHERE civic_issue_id=?').get(issueId).count, 0);

  addLegacyIndividualAssignment(issueId);
  assert.equal(db.prepare('SELECT assigned_officer_id FROM civic_issues WHERE id = ?').get(issueId).assigned_officer_id, 3);
  assert.equal(db.prepare('SELECT status FROM civic_issues WHERE id = ?').get(issueId).status, 'OPEN');
  assert.throws(() => db.prepare('UPDATE civic_issues SET assigned_officer_id = 2 WHERE id = ?').run(issueId));
  assert.throws(() => db.prepare("UPDATE users SET role = 'CITIZEN' WHERE id = 3").run());

  const detail = await request(`/api/admin/civic-issues/${issueId}`, { userId: 1 });
  const { issue } = await detail.json();
  assert.equal(issue.currentAssignment.officerId, 3);
  assert.equal(issue.assignmentHistory.length, 1);

  const duplicate = await request(`/api/admin/civic-issues/${issueId}/assignments`, {
    userId: 1, method: 'POST', body: { officerId: 4 }
  });
  assert.equal(duplicate.status, 409);

  const reassign = await request(`/api/admin/civic-issues/${issueId}/assignments/reassign`, {
    userId: 1, method: 'POST', body: { officerId: 4 }
  });
  assert.equal(reassign.status, 409);
  assert.equal(db.prepare('SELECT assigned_officer_id FROM civic_issues WHERE id = ?').get(issueId).assigned_officer_id, 3);

  const unassign = await request(`/api/admin/civic-issues/${issueId}/assignments/unassign`, { userId: 1, method: 'POST' });
  assert.equal(unassign.status, 200);
  assert.equal((await unassign.json()).assignment.eventType, 'UNASSIGNED');
  assert.equal(db.prepare('SELECT assigned_officer_id FROM civic_issues WHERE id = ?').get(issueId).assigned_officer_id, null);
  const events = db.prepare(`SELECT event_type, previous_officer_id, officer_id
    FROM civic_issue_assignment_events WHERE civic_issue_id = ? ORDER BY id`).all(issueId);
  assert.deepEqual(events.map((event) => event.event_type), ['ASSIGNED', 'UNASSIGNED']);
  assert.deepEqual(events.map((event) => [event.previous_officer_id, event.officer_id]), [[null, 3], [3, null]]);
  assert.throws(() => db.prepare('UPDATE civic_issue_assignment_events SET event_type = event_type WHERE civic_issue_id = ?').run(issueId));
});

test('merged issues reject assignment and failed legacy unassignment rolls back current state', async () => {
  const mergedAssignment = await request(`/api/admin/civic-issues/${mergedIssueId}/assignments`, {
    userId: 1, method: 'POST', body: { officerId: 3 }
  });
  assert.equal(mergedAssignment.status, 409);

  addLegacyIndividualAssignment(issueId);
  db.exec(`CREATE TRIGGER test_fail_assignment_event BEFORE INSERT ON civic_issue_assignment_events
    WHEN NEW.civic_issue_id = ${issueId} BEGIN SELECT RAISE(ABORT, 'forced test failure'); END`);
  const failed = await request(`/api/admin/civic-issues/${issueId}/assignments/unassign`, { userId: 1, method: 'POST' });
  assert.equal(failed.status, 500);
  assert.equal(db.prepare('SELECT assigned_officer_id FROM civic_issues WHERE id = ?').get(issueId).assigned_officer_id, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_assignment_events WHERE civic_issue_id = ?').get(issueId).count, 3);
  db.exec('DROP TRIGGER test_fail_assignment_event');
});

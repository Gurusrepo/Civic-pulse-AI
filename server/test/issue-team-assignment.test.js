import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import jwt from 'jsonwebtoken';

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'civicpulse-team-assignment-test-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_PATH: path.join(tempDirectory, 'team-assignment.sqlite'),
  JWT_SECRET: 'team-assignment-test-secret-long-enough', CORS_ORIGINS: 'http://localhost:3000',
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'test-key',
  GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.5-flash-lite'
});

const { db, closeDatabase } = await import('../src/config/database.js');
const { migrateDatabase } = await import('../src/database/migrate.js');
migrateDatabase(db);
const { default: app } = await import('../src/app.js');

let server;
let baseUrl;
let ids = {};

function addUser(id, role) {
  db.prepare(`INSERT INTO users(id,display_name,email,password_hash,role,email_verified)
    VALUES(?,?,?,'test-hash',?,?)`).run(id, `Team Test ${id}`, `team-assignment-${id}@example.test`, role,
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
  return fetch(`${baseUrl}${pathname}`, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
function createTeam(wardId, name, department, active = true) {
  return Number(db.prepare('INSERT INTO ward_teams(ward_id,name,department,is_active) VALUES(?,?,?,?)')
    .run(wardId, name, department, active ? 1 : 0).lastInsertRowid);
}
function createIssue() { return Number(db.prepare('INSERT INTO civic_issues DEFAULT VALUES').run().lastInsertRowid); }
function createMembership(teamId, officerId) {
  db.prepare('INSERT INTO ward_team_memberships(team_id,officer_user_id,added_by_admin_id) VALUES(?,?,1)').run(teamId, officerId);
}

before(async () => {
  addUser(1, 'ADMIN'); addUser(2, 'CITIZEN'); addUser(3, 'OFFICER'); addUser(4, 'OFFICER');
  ids.ward = Number(db.prepare("INSERT INTO wards(code,name) VALUES('NORTH','North Ward')").run().lastInsertRowid);
  ids.teamA = createTeam(ids.ward, 'Road Team', 'Roads & Infrastructure');
  ids.teamB = createTeam(ids.ward, 'Water Team', 'Water Supply');
  ids.emptyTeam = createTeam(ids.ward, 'Empty Team', 'Roads & Infrastructure');
  createMembership(ids.teamA, 3); createMembership(ids.teamB, 4);
  ids.issue = createIssue(); ids.rollbackIssue = createIssue();

  ids.inactiveWard = Number(db.prepare("INSERT INTO wards(code,name,is_active) VALUES('SOUTH','South Ward',0)").run().lastInsertRowid);
  ids.inactiveTeam = createTeam(ids.inactiveWard, 'Inactive Team', 'Roads & Infrastructure', false);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  closeDatabase();
  fs.rmSync(tempDirectory, { recursive: true, force: true });
});

const routeBody = (teamId, routingDepartment) => ({ teamId, routingDepartment });

test('ADMIN team assignment checks route approval, active ward/team, and current OFFICER membership', async () => {
  for (const userId of [2, 3]) {
    assert.equal((await request(`/api/admin/civic-issues/${ids.issue}/team-assignments`, {
      userId, method: 'POST', body: routeBody(ids.teamA, 'Roads & Infrastructure')
    })).status, 403);
  }

  const departmentMismatch = await request(`/api/admin/civic-issues/${ids.issue}/team-assignments`, {
    method: 'POST', body: routeBody(ids.teamB, 'Roads & Infrastructure')
  });
  assert.equal(departmentMismatch.status, 409);

  const noMembers = await request(`/api/admin/civic-issues/${ids.issue}/team-assignments`, {
    method: 'POST', body: routeBody(ids.emptyTeam, 'Roads & Infrastructure')
  });
  assert.equal(noMembers.status, 409);

  const inactive = await request(`/api/admin/civic-issues/${ids.issue}/team-assignments`, {
    method: 'POST', body: routeBody(ids.inactiveTeam, 'Roads & Infrastructure')
  });
  assert.equal(inactive.status, 409);
  assert.equal(db.prepare('SELECT assigned_team_id FROM civic_issues WHERE id=?').get(ids.issue).assigned_team_id, null);

  const assigned = await request(`/api/admin/civic-issues/${ids.issue}/team-assignments`, {
    method: 'POST', body: routeBody(ids.teamA, 'Roads & Infrastructure')
  });
  assert.equal(assigned.status, 201);
  assert.equal((await assigned.json()).assignment.eventType, 'ASSIGNED');
  const current = db.prepare('SELECT assigned_team_id,routing_department FROM civic_issues WHERE id=?').get(ids.issue);
  assert.deepEqual(current, { assigned_team_id: ids.teamA, routing_department: 'Roads & Infrastructure' });
  const details = await request(`/api/admin/civic-issues/${ids.issue}`);
  const { issue } = await details.json();
  assert.equal(issue.currentTeamAssignment.teamId, ids.teamA);
  assert.equal(issue.currentTeamAssignment.department, 'Roads & Infrastructure');
  assert.deepEqual(issue.teamAssignmentHistory.map(event => event.eventType), ['ASSIGNED']);
});

test('assigned team safeguards block last member removal, department changes, and deactivation', async () => {
  const removeLast = await request(`/api/admin/ward-teams/${ids.teamA}/members/3`, { method: 'DELETE' });
  assert.equal(removeLast.status, 409);
  assert.equal(db.prepare('SELECT removed_at FROM ward_team_memberships WHERE team_id=? AND officer_user_id=3').get(ids.teamA).removed_at, null);

  const changeDepartment = await request(`/api/admin/ward-teams/${ids.teamA}`, {
    method: 'PATCH', body: { department: 'Public Works' }
  });
  assert.equal(changeDepartment.status, 409);
  const deactivateTeam = await request(`/api/admin/ward-teams/${ids.teamA}`, {
    method: 'PATCH', body: { active: false }
  });
  assert.equal(deactivateTeam.status, 409);
  const deactivateWard = await request(`/api/admin/wards/${ids.ward}`, { method: 'DELETE' });
  assert.equal(deactivateWard.status, 409);

  assert.throws(() => db.prepare("UPDATE ward_teams SET department='Public Works' WHERE id=?").run(ids.teamA));
  assert.throws(() => db.prepare('UPDATE ward_teams SET is_active=0 WHERE id=?').run(ids.teamA));
  assert.throws(() => db.prepare('UPDATE wards SET is_active=0 WHERE id=?').run(ids.ward));
  assert.throws(() => db.prepare('UPDATE ward_team_memberships SET removed_by_admin_id=1,removed_at=strftime(\'%Y-%m-%dT%H:%M:%fZ\',\'now\') WHERE team_id=? AND officer_user_id=3').run(ids.teamA));
});

test('assignment and reassignment commit together with immutable history; unassignment appends history', async () => {
  const forcedFailure = `CREATE TRIGGER fail_team_assignment_event BEFORE INSERT ON civic_issue_team_assignment_events
    WHEN NEW.civic_issue_id=${ids.rollbackIssue} BEGIN SELECT RAISE(ABORT,'forced'); END`;
  db.exec(forcedFailure);
  const failed = await request(`/api/admin/civic-issues/${ids.rollbackIssue}/team-assignments`, {
    method: 'POST', body: routeBody(ids.teamA, 'Roads & Infrastructure')
  });
  assert.equal(failed.status, 500);
  assert.equal(db.prepare('SELECT assigned_team_id FROM civic_issues WHERE id=?').get(ids.rollbackIssue).assigned_team_id, null);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_team_assignment_events WHERE civic_issue_id=?').get(ids.rollbackIssue).count, 0);
  db.exec('DROP TRIGGER fail_team_assignment_event');

  const reassignFailure = `CREATE TRIGGER fail_team_reassignment_event BEFORE INSERT ON civic_issue_team_assignment_events
    WHEN NEW.civic_issue_id=${ids.issue} AND NEW.event_type='REASSIGNED' BEGIN SELECT RAISE(ABORT,'forced'); END`;
  db.exec(reassignFailure);
  const failedReassign = await request(`/api/admin/civic-issues/${ids.issue}/team-assignments/reassign`, {
    method: 'POST', body: routeBody(ids.teamB, 'Water Supply')
  });
  assert.equal(failedReassign.status, 500);
  assert.equal(db.prepare('SELECT assigned_team_id FROM civic_issues WHERE id=?').get(ids.issue).assigned_team_id, ids.teamA);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM civic_issue_team_assignment_events WHERE civic_issue_id=?').get(ids.issue).count, 1);
  db.exec('DROP TRIGGER fail_team_reassignment_event');

  const reassigned = await request(`/api/admin/civic-issues/${ids.issue}/team-assignments/reassign`, {
    method: 'POST', body: routeBody(ids.teamB, 'Water Supply')
  });
  assert.equal(reassigned.status, 200);
  assert.equal((await reassigned.json()).assignment.eventType, 'REASSIGNED');
  assert.equal(db.prepare('SELECT assigned_team_id,routing_department FROM civic_issues WHERE id=?').get(ids.issue).assigned_team_id, ids.teamB);

  const unassigned = await request(`/api/admin/civic-issues/${ids.issue}/team-assignments/unassign`, { method: 'POST' });
  assert.equal(unassigned.status, 200);
  assert.equal((await unassigned.json()).assignment.eventType, 'UNASSIGNED');
  assert.deepEqual(db.prepare(`SELECT event_type,previous_team_id,team_id,approved_department
    FROM civic_issue_team_assignment_events WHERE civic_issue_id=? ORDER BY id`).all(ids.issue), [
    { event_type: 'ASSIGNED', previous_team_id: null, team_id: ids.teamA, approved_department: 'Roads & Infrastructure' },
    { event_type: 'REASSIGNED', previous_team_id: ids.teamA, team_id: ids.teamB, approved_department: 'Water Supply' },
    { event_type: 'UNASSIGNED', previous_team_id: ids.teamB, team_id: null, approved_department: 'Water Supply' }
  ]);
  assert.equal(db.prepare('SELECT assigned_team_id,routing_department FROM civic_issues WHERE id=?').get(ids.issue).assigned_team_id, null);
  assert.throws(() => db.prepare('UPDATE civic_issue_team_assignment_events SET event_type=event_type WHERE civic_issue_id=?').run(ids.issue));
  assert.throws(() => db.prepare('DELETE FROM civic_issue_team_assignment_events WHERE civic_issue_id=?').run(ids.issue));

  const details = await request(`/api/admin/civic-issues/${ids.issue}`);
  const { issue } = await details.json();
  assert.equal(issue.currentTeamAssignment, null);
  assert.deepEqual(issue.teamAssignmentHistory.map(event => event.eventType), ['ASSIGNED','REASSIGNED','UNASSIGNED']);
});

test('team assignment rejects legacy individual assignment and duplicate grouping sees team conflicts', async () => {
  const individualIssue = ids.rollbackIssue;
  db.exec('DROP TRIGGER civic_issue_individual_assignment_deprecated');
  db.prepare('UPDATE civic_issues SET assigned_officer_id=3 WHERE id=?').run(individualIssue);
  db.prepare(`INSERT INTO civic_issue_assignment_events(civic_issue_id,event_type,previous_officer_id,officer_id,admin_user_id)
    VALUES(?,'ASSIGNED',NULL,3,1)`).run(individualIssue);
  db.exec(`CREATE TRIGGER civic_issue_individual_assignment_deprecated
    BEFORE UPDATE OF assigned_officer_id ON civic_issues
    WHEN NEW.assigned_officer_id IS NOT NULL AND NEW.assigned_officer_id IS NOT OLD.assigned_officer_id
    BEGIN SELECT RAISE(ABORT,'new individual assignments are disabled'); END`);

  const teamRejected = await request(`/api/admin/civic-issues/${individualIssue}/team-assignments`, {
    method: 'POST', body: routeBody(ids.teamA, 'Roads & Infrastructure')
  });
  assert.equal(teamRejected.status, 409);
  const individualRejected = await request(`/api/admin/civic-issues/${individualIssue}/assignments/reassign`, {
    method: 'POST', body: { officerId: 4 }
  });
  assert.equal(individualRejected.status, 409);

  const source = createIssue(), target = createIssue();
  const [a,b] = [source,target].sort((x,y) => x-y);
  const suggestionId = Number(db.prepare(`INSERT INTO civic_issue_duplicate_suggestions
    (issue_a_id,issue_b_id,deterministic_score,signals_json) VALUES(?,?,.8,'{}')`).run(a,b).lastInsertRowid);
  db.prepare('UPDATE civic_issues SET assigned_team_id=?,routing_department=? WHERE id=?')
    .run(ids.teamA,'Roads & Infrastructure',source);
  const { approveDuplicate } = await import('../src/modules/admin/duplicate.service.js');
  assert.throws(() => approveDuplicate(suggestionId,target,1), { status: 409 });
});

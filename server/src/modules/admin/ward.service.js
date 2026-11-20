import { db } from '../../config/database.js';
import { departments } from '../intelligence/intelligence.taxonomy.js';

export class WardAdminError extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

const isAdmin = (id) => db.prepare("SELECT 1 FROM users WHERE id = ? AND role = 'ADMIN'").get(id);
const getWardRow = db.prepare(`SELECT w.id,w.code,w.name,w.is_active,w.created_at,w.updated_at,
  (SELECT COUNT(*) FROM ward_teams t WHERE t.ward_id=w.id) AS team_count,
  (SELECT COUNT(*) FROM ward_teams t WHERE t.ward_id=w.id AND t.is_active=1) AS active_team_count
  FROM wards w WHERE w.id=?`);
const getTeamRow = db.prepare(`SELECT t.id,t.ward_id,t.name,t.department,t.is_active,t.created_at,t.updated_at,
  w.code AS ward_code,w.name AS ward_name,
  (SELECT COUNT(*) FROM ward_team_memberships m
    WHERE m.team_id=t.id AND m.removed_at IS NULL) AS membership_count,
  (SELECT COUNT(*) FROM ward_team_memberships m JOIN users u ON u.id=m.officer_user_id
    WHERE m.team_id=t.id AND m.removed_at IS NULL AND u.role='OFFICER' AND u.account_status='ACTIVE') AS active_member_count
  FROM ward_teams t JOIN wards w ON w.id=t.ward_id WHERE t.id=?`);

function mapWard(row) {
  return row && { id: row.id, code: row.code, name: row.name, active: Boolean(row.is_active),
    teamCount: row.team_count, activeTeamCount: row.active_team_count, createdAt: row.created_at, updatedAt: row.updated_at };
}
function mapTeam(row) {
  return row && { id: row.id, ward: { id: row.ward_id, code: row.ward_code, name: row.ward_name },
    name: row.name, department: row.department, active: Boolean(row.is_active), activeMemberCount: row.active_member_count,
    createdAt: row.created_at, updatedAt: row.updated_at };
}
function requireAdmin(adminId) {
  if (!isAdmin(adminId)) throw new WardAdminError('Admin authorization is required', 403);
}
function ensureWardCodeAvailable(code, exceptId = null) {
  const row = db.prepare(`SELECT id FROM wards WHERE code = ? COLLATE NOCASE AND (? IS NULL OR id <> ?)`).get(code, exceptId, exceptId);
  if (row) throw new WardAdminError('A ward with that code already exists', 409);
}
function ensureTeamNameAvailable(wardId, name, exceptId = null) {
  const row = db.prepare(`SELECT id FROM ward_teams WHERE ward_id=? AND name=? COLLATE NOCASE AND (? IS NULL OR id<>?)`)
    .get(wardId, name, exceptId, exceptId);
  if (row) throw new WardAdminError('A team with that name already exists in this ward', 409);
}
const assignedIssuesForTeam = (teamId) => db.prepare('SELECT COUNT(*) AS count FROM civic_issues WHERE assigned_team_id=?').get(teamId).count;

const createWardTx = db.transaction((input, adminId) => {
  requireAdmin(adminId);
  ensureWardCodeAvailable(input.code);
  const result = db.prepare('INSERT INTO wards(code,name) VALUES(?,?)').run(input.code, input.name);
  return mapWard(getWardRow.get(Number(result.lastInsertRowid)));
});
export const createWard = (input, adminId) => createWardTx.immediate(input, adminId);

export function listWards({ includeInactive = false } = {}) {
  return db.prepare(`SELECT w.id,w.code,w.name,w.is_active,w.created_at,w.updated_at,
      (SELECT COUNT(*) FROM ward_teams t WHERE t.ward_id=w.id) AS team_count,
      (SELECT COUNT(*) FROM ward_teams t WHERE t.ward_id=w.id AND t.is_active=1) AS active_team_count
    FROM wards w ${includeInactive ? '' : 'WHERE w.is_active=1'} ORDER BY w.code,w.id`)
    .all().map(mapWard);
}

export function getWard(id) { return mapWard(getWardRow.get(id)); }

const updateWardTx = db.transaction((id, input, adminId) => {
  requireAdmin(adminId);
  const current = getWardRow.get(id);
  if (!current) throw new WardAdminError('Ward not found', 404);
  const code = input.code ?? current.code, name = input.name ?? current.name;
  const active = input.active === undefined ? current.is_active : Number(input.active);
  if (!active && db.prepare(`SELECT COUNT(*) AS count FROM civic_issues i JOIN ward_teams t ON t.id=i.assigned_team_id WHERE t.ward_id=?`).get(id).count) {
    throw new WardAdminError('Unassign issues from this ward before deactivating it', 409);
  }
  if (!active && current.active_team_count) throw new WardAdminError('Deactivate the ward teams before deactivating this ward', 409);
  ensureWardCodeAvailable(code, id);
  const updated = db.prepare(`UPDATE wards SET code=?,name=?,is_active=?,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).run(code, name, active, id);
  if (updated.changes !== 1) throw new WardAdminError('Ward changed; retry the request', 409);
  return mapWard(getWardRow.get(id));
});
export const updateWard = (id, input, adminId) => updateWardTx.immediate(id, input, adminId);

const deactivateWardTx = db.transaction((id, adminId) => {
  requireAdmin(adminId);
  const ward = getWardRow.get(id);
  if (!ward) throw new WardAdminError('Ward not found', 404);
  if (db.prepare(`SELECT COUNT(*) AS count FROM civic_issues i JOIN ward_teams t ON t.id=i.assigned_team_id WHERE t.ward_id=?`).get(id).count) {
    throw new WardAdminError('Unassign issues from this ward before deactivating it', 409);
  }
  if (ward.active_team_count) throw new WardAdminError('Deactivate the ward teams before deactivating this ward', 409);
  db.prepare(`UPDATE wards SET is_active=0,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).run(id);
  return mapWard(getWardRow.get(id));
});
export const deactivateWard = (id, adminId) => deactivateWardTx.immediate(id, adminId);

const createTeamTx = db.transaction((input, adminId) => {
  requireAdmin(adminId);
  if (!departments.includes(input.department)) throw new WardAdminError('Invalid department', 400);
  const ward = db.prepare('SELECT id,is_active FROM wards WHERE id=?').get(input.wardId);
  if (!ward) throw new WardAdminError('Ward not found', 404);
  if (!ward.is_active) throw new WardAdminError('Cannot create a team in an inactive ward', 409);
  ensureTeamNameAvailable(input.wardId, input.name);
  const result = db.prepare('INSERT INTO ward_teams(ward_id,name,department) VALUES(?,?,?)')
    .run(input.wardId, input.name, input.department);
  return mapTeam(getTeamRow.get(Number(result.lastInsertRowid)));
});
export const createTeam = (input, adminId) => createTeamTx.immediate(input, adminId);

export function listTeams({ wardId, includeInactive = false } = {}) {
  const conditions = [], params = [];
  if (!includeInactive) conditions.push('t.is_active=1 AND w.is_active=1');
  if (wardId !== undefined) { conditions.push('t.ward_id=?'); params.push(wardId); }
  return db.prepare(`SELECT t.id,t.ward_id,t.name,t.department,t.is_active,t.created_at,t.updated_at,
      w.code AS ward_code,w.name AS ward_name,
      (SELECT COUNT(*) FROM ward_team_memberships m
        WHERE m.team_id=t.id AND m.removed_at IS NULL) AS membership_count,
      (SELECT COUNT(*) FROM ward_team_memberships m JOIN users u ON u.id=m.officer_user_id
        WHERE m.team_id=t.id AND m.removed_at IS NULL AND u.role='OFFICER' AND u.account_status='ACTIVE') AS active_member_count
    FROM ward_teams t JOIN wards w ON w.id=t.ward_id ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY w.code,t.department,t.name,t.id`).all(...params).map(mapTeam);
}

export function getTeam(id) { return mapTeam(getTeamRow.get(id)); }

const updateTeamTx = db.transaction((id, input, adminId) => {
  requireAdmin(adminId);
  const current = getTeamRow.get(id);
  if (!current) throw new WardAdminError('Ward team not found', 404);
  const wardId = input.wardId ?? current.ward_id;
  const name = input.name ?? current.name;
  const department = input.department ?? current.department;
  const active = input.active === undefined ? current.is_active : Number(input.active);
  if (!departments.includes(department)) throw new WardAdminError('Invalid department', 400);
  const ward = db.prepare('SELECT is_active FROM wards WHERE id=?').get(wardId);
  if (!ward) throw new WardAdminError('Ward not found', 404);
  if (active && !ward.is_active) throw new WardAdminError('An active team requires an active ward', 409);
  if (!active && assignedIssuesForTeam(id)) throw new WardAdminError('Unassign issues before deactivating this team', 409);
  if (!active && current.membership_count) throw new WardAdminError('Remove active team members before deactivating this team', 409);
  if (wardId !== current.ward_id && assignedIssuesForTeam(id)) throw new WardAdminError('Unassign issues before moving this team to another ward', 409);
  if (department !== current.department && assignedIssuesForTeam(id)) throw new WardAdminError('Unassign issues before changing this team department', 409);
  ensureTeamNameAvailable(wardId, name, id);
  const updated = db.prepare(`UPDATE ward_teams SET ward_id=?,name=?,department=?,is_active=?,
    updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?`).run(wardId, name, department, active, id);
  if (updated.changes !== 1) throw new WardAdminError('Ward team changed; retry the request', 409);
  return mapTeam(getTeamRow.get(id));
});
export const updateTeam = (id, input, adminId) => updateTeamTx.immediate(id, input, adminId);

export function listTeamMemberships(teamId, { includeHistory = false } = {}) {
  if (!getTeamRow.get(teamId)) throw new WardAdminError('Ward team not found', 404);
  return db.prepare(`SELECT m.id,m.team_id,m.officer_user_id,u.display_name,u.email,u.account_status,
      m.added_by_admin_id,added.display_name AS added_by_name,m.added_at,
      m.removed_by_admin_id,removed.display_name AS removed_by_name,m.removed_at
    FROM ward_team_memberships m JOIN users u ON u.id=m.officer_user_id
    JOIN users added ON added.id=m.added_by_admin_id
    LEFT JOIN users removed ON removed.id=m.removed_by_admin_id
    WHERE m.team_id=? ${includeHistory ? '' : 'AND m.removed_at IS NULL'}
    ORDER BY m.added_at DESC,m.id DESC`).all(teamId).map(row => ({
      membershipId: row.id, teamId: row.team_id,
      officer: { id: row.officer_user_id, name: row.display_name, email: row.email, status: row.account_status },
      addedBy: { id: row.added_by_admin_id, name: row.added_by_name }, addedAt: row.added_at,
      active: row.removed_at === null,
      removedBy: row.removed_by_admin_id === null ? null : { id: row.removed_by_admin_id, name: row.removed_by_name },
      removedAt: row.removed_at
    }));
}

const addMemberTx = db.transaction((teamId, officerId, adminId) => {
  requireAdmin(adminId);
  const team = getTeamRow.get(teamId);
  if (!team) throw new WardAdminError('Ward team not found', 404);
  if (!team.is_active || !db.prepare('SELECT is_active FROM wards WHERE id=?').get(team.ward_id).is_active) {
    throw new WardAdminError('Cannot add members to an inactive team or ward', 409);
  }
  if (!db.prepare("SELECT id FROM users WHERE id=? AND role='OFFICER' AND account_status='ACTIVE'").get(officerId)) {
    throw new WardAdminError('Team member must be an active OFFICER account', 400);
  }
  if (db.prepare('SELECT id FROM ward_team_memberships WHERE team_id=? AND officer_user_id=? AND removed_at IS NULL').get(teamId, officerId)) {
    throw new WardAdminError('Officer is already an active member of this team', 409);
  }
  const result = db.prepare('INSERT INTO ward_team_memberships(team_id,officer_user_id,added_by_admin_id) VALUES(?,?,?)')
    .run(teamId, officerId, adminId);
  return listTeamMemberships(teamId, { includeHistory: true }).find(row => row.membershipId === Number(result.lastInsertRowid));
});
export const addTeamMember = (teamId, officerId, adminId) => addMemberTx.immediate(teamId, officerId, adminId);

const removeMemberTx = db.transaction((teamId, officerId, adminId) => {
  requireAdmin(adminId);
  const team = getTeamRow.get(teamId);
  if (!team) throw new WardAdminError('Ward team not found', 404);
  if (!db.prepare('SELECT id FROM ward_team_memberships WHERE team_id=? AND officer_user_id=? AND removed_at IS NULL').get(teamId, officerId)) {
    throw new WardAdminError('Active team membership not found', 404);
  }
  const activeMembers = team.active_member_count;
  const memberAccount = db.prepare('SELECT account_status FROM users WHERE id=? AND role=\'OFFICER\'').get(officerId);
  if (memberAccount?.account_status === 'ACTIVE' && activeMembers <= 1 && assignedIssuesForTeam(teamId)) {
    throw new WardAdminError('Cannot remove the last active team member while issues are assigned', 409);
  }
  const result = db.prepare(`UPDATE ward_team_memberships SET removed_by_admin_id=?,
      removed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE team_id=? AND officer_user_id=? AND removed_at IS NULL`).run(adminId, teamId, officerId);
  if (result.changes !== 1) throw new WardAdminError('Active team membership not found', 404);
  return listTeamMemberships(teamId, { includeHistory: true }).find(row => row.officer.id === officerId && !row.active) ?? null;
});
export const removeTeamMember = (teamId, officerId, adminId) => removeMemberTx.immediate(teamId, officerId, adminId);

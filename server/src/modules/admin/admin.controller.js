import * as adminService from './admin.service.js';
import * as wardService from './ward.service.js';
import * as teamAssignmentService from './team-assignment.service.js';

export function listIssues(req, res, next) {
  try { res.json(adminService.listCivicIssues(req.validatedQuery)); }
  catch (error) { next(error); }
}

export function getIssue(req, res, next) {
  try {
    const issue = adminService.getCivicIssue(req.params.id);
    if (!issue) return res.status(404).json({ error: 'Civic issue not found' });
    res.json({ issue });
  } catch (error) { next(error); }
}

export function assignOfficer(req, res, next) {
  try { res.status(201).json({ assignment: adminService.assignOfficer(req.params.id, req.body.officerId, req.user.id) }); }
  catch (error) { next(error); }
}

export function reassignOfficer(req, res, next) {
  try { res.json({ assignment: adminService.reassignOfficer(req.params.id, req.body.officerId, req.user.id) }); }
  catch (error) { next(error); }
}

export function unassignOfficer(req, res, next) {
  try { res.json({ assignment: adminService.unassignOfficer(req.params.id, req.user.id) }); }
  catch (error) { next(error); }
}
export function assignIssueTeam(req, res, next) {
  try {
    res.status(201).json({ assignment: teamAssignmentService.assignIssueToTeam(
      req.params.id, req.body.teamId, req.body.routingDepartment, req.user.id
    ) });
  } catch (error) { next(error); }
}
export function reassignIssueTeam(req, res, next) {
  try {
    res.json({ assignment: teamAssignmentService.reassignIssueTeam(
      req.params.id, req.body.teamId, req.body.routingDepartment, req.user.id
    ) });
  } catch (error) { next(error); }
}
export function unassignIssueTeam(req, res, next) {
  try { res.json({ assignment: teamAssignmentService.unassignIssueTeam(req.params.id, req.user.id) }); }
  catch (error) { next(error); }
}

export function listWards(req, res, next) {
  try { res.json({ items: wardService.listWards(req.validatedQuery) }); } catch (error) { next(error); }
}
export function getWard(req, res, next) {
  try {
    const ward = wardService.getWard(req.params.id);
    if (!ward) return res.status(404).json({ error: 'Ward not found' });
    res.json({ ward });
  } catch (error) { next(error); }
}
export function createWard(req, res, next) {
  try { res.status(201).json({ ward: wardService.createWard(req.body, req.user.id) }); } catch (error) { next(error); }
}
export function updateWard(req, res, next) {
  try { res.json({ ward: wardService.updateWard(req.params.id, req.body, req.user.id) }); } catch (error) { next(error); }
}
export function deleteWard(req, res, next) {
  try { res.json({ ward: wardService.deactivateWard(req.params.id, req.user.id) }); } catch (error) { next(error); }
}
export function listTeams(req, res, next) {
  try { res.json({ items: wardService.listTeams(req.validatedQuery) }); } catch (error) { next(error); }
}
export function getTeam(req, res, next) {
  try {
    const team = wardService.getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: 'Ward team not found' });
    res.json({ team });
  } catch (error) { next(error); }
}
export function createTeam(req, res, next) {
  try { res.status(201).json({ team: wardService.createTeam(req.body, req.user.id) }); } catch (error) { next(error); }
}
export function updateTeam(req, res, next) {
  try { res.json({ team: wardService.updateTeam(req.params.id, req.body, req.user.id) }); } catch (error) { next(error); }
}
export function listTeamMembers(req, res, next) {
  try { res.json({ items: wardService.listTeamMemberships(req.params.id, req.validatedQuery) }); } catch (error) { next(error); }
}
export function addTeamMember(req, res, next) {
  try { res.status(201).json({ membership: wardService.addTeamMember(req.params.id, req.body.officerId, req.user.id) }); } catch (error) { next(error); }
}
export function removeTeamMember(req, res, next) {
  try { res.json({ membership: wardService.removeTeamMember(req.params.id, req.params.userId, req.user.id) }); } catch (error) { next(error); }
}

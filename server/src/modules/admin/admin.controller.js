import * as adminService from './admin.service.js';

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

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './admin.controller.js';
import {
  assignOfficerSchema, issueIdSchema, issueListQuerySchema, duplicateListQuerySchema, duplicateIdSchema,
  approveDuplicateSchema, rejectDuplicateSchema, wardIdSchema, memberParamsSchema, wardListQuerySchema,
  teamListQuerySchema, membershipListQuerySchema, createWardSchema, updateWardSchema,
  createTeamSchema, updateTeamSchema, addTeamMemberSchema, teamRoutingSchema
} from './admin.validation.js';
import * as duplicateController from './duplicate.controller.js';

const router = Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/civic-issues', validate(issueListQuerySchema, 'query'), controller.listIssues);
router.get('/civic-issues/:id', validate(issueIdSchema, 'params'), controller.getIssue);
router.post('/civic-issues/:id/assignments', validate(issueIdSchema, 'params'), validate(assignOfficerSchema), controller.assignOfficer);
router.post('/civic-issues/:id/assignments/reassign', validate(issueIdSchema, 'params'), validate(assignOfficerSchema), controller.reassignOfficer);
router.post('/civic-issues/:id/assignments/unassign', validate(issueIdSchema, 'params'), controller.unassignOfficer);
router.post('/civic-issues/:id/team-assignments', validate(issueIdSchema, 'params'), validate(teamRoutingSchema), controller.assignIssueTeam);
router.post('/civic-issues/:id/team-assignments/reassign', validate(issueIdSchema, 'params'), validate(teamRoutingSchema), controller.reassignIssueTeam);
router.post('/civic-issues/:id/team-assignments/unassign', validate(issueIdSchema, 'params'), controller.unassignIssueTeam);
router.get('/wards', validate(wardListQuerySchema, 'query'), controller.listWards);
router.post('/wards', validate(createWardSchema), controller.createWard);
router.get('/wards/:id', validate(wardIdSchema, 'params'), controller.getWard);
router.patch('/wards/:id', validate(wardIdSchema, 'params'), validate(updateWardSchema), controller.updateWard);
router.delete('/wards/:id', validate(wardIdSchema, 'params'), controller.deleteWard);
router.get('/ward-teams', validate(teamListQuerySchema, 'query'), controller.listTeams);
router.post('/ward-teams', validate(createTeamSchema), controller.createTeam);
router.get('/ward-teams/:id/members', validate(wardIdSchema, 'params'), validate(membershipListQuerySchema, 'query'), controller.listTeamMembers);
router.post('/ward-teams/:id/members', validate(wardIdSchema, 'params'), validate(addTeamMemberSchema), controller.addTeamMember);
router.delete('/ward-teams/:id/members/:userId', validate(memberParamsSchema, 'params'), controller.removeTeamMember);
router.get('/ward-teams/:id', validate(wardIdSchema, 'params'), controller.getTeam);
router.patch('/ward-teams/:id', validate(wardIdSchema, 'params'), validate(updateTeamSchema), controller.updateTeam);
router.get('/duplicate-candidates', validate(duplicateListQuerySchema, 'query'), duplicateController.list);
router.post('/duplicate-candidates/:id/assess', validate(duplicateIdSchema, 'params'), duplicateController.assess);
router.post('/duplicate-candidates/:id/approve', validate(duplicateIdSchema, 'params'), validate(approveDuplicateSchema), duplicateController.approve);
router.post('/duplicate-candidates/:id/reject', validate(duplicateIdSchema, 'params'), validate(rejectDuplicateSchema), duplicateController.reject);

export default router;

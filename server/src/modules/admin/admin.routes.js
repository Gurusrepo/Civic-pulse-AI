import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './admin.controller.js';
import { assignOfficerSchema, issueIdSchema, issueListQuerySchema } from './admin.validation.js';

const router = Router();
router.use(authenticate, authorize('ADMIN'));
router.get('/civic-issues', validate(issueListQuerySchema, 'query'), controller.listIssues);
router.get('/civic-issues/:id', validate(issueIdSchema, 'params'), controller.getIssue);
router.post('/civic-issues/:id/assignments', validate(issueIdSchema, 'params'), validate(assignOfficerSchema), controller.assignOfficer);
router.post('/civic-issues/:id/assignments/reassign', validate(issueIdSchema, 'params'), validate(assignOfficerSchema), controller.reassignOfficer);
router.post('/civic-issues/:id/assignments/unassign', validate(issueIdSchema, 'params'), controller.unassignOfficer);

export default router;

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { supportUpload } from '../middleware/supportUpload.js';
import * as controller from './support.controller.js';
import { bugReportSchema, suggestionSchema } from './support.validation.js';

const router = Router();
router.use(authenticate, authorize('CITIZEN'));
router.post('/reports', supportUpload, validate(bugReportSchema), controller.submitBugReport);
router.post('/suggestions', validate(suggestionSchema), controller.submitSuggestion);

export default router;

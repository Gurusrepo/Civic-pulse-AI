import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as objectStorage from '../../services/objectStorage.js';
import { createOfficerController } from './officer.controller.js';
import { createOfficerService } from './officer.service.js';
import { issueIdSchema, issueListQuerySchema, repairEvidenceSchema } from './officer.validation.js';
import { repairEvidenceUpload } from './repairEvidenceUpload.js';

export function createOfficerRouter(storageAdapter = objectStorage) {
  const router = Router();
  const controller = createOfficerController(createOfficerService(storageAdapter));
  router.use(authenticate, authorize('OFFICER'));
  router.get('/civic-issues', validate(issueListQuerySchema, 'query'), controller.list);
  router.get('/civic-issues/:id', validate(issueIdSchema, 'params'), controller.get);
  router.post('/civic-issues/:id/start', validate(issueIdSchema, 'params'), controller.start);
  router.post('/civic-issues/:id/repair-evidence', validate(issueIdSchema, 'params'), repairEvidenceUpload,
    validate(repairEvidenceSchema), controller.upload);
  router.get('/civic-issues/:id/repair-evidence', validate(issueIdSchema, 'params'), controller.evidence);
  router.post('/civic-issues/:id/complete', validate(issueIdSchema, 'params'), controller.complete);
  return router;
}

export default createOfficerRouter();

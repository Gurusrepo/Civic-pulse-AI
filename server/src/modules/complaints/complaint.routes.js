import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { complaintUpload } from '../../middleware/complaintUpload.js';
import * as controller from './complaint.controller.js';
import { complaintIdSchema, createComplaintSchema, listComplaintsSchema, resolutionVerificationSchema } from './complaint.validation.js';
import { createResolutionController } from './complaint.controller.js';
import * as objectStorage from '../../services/objectStorage.js';

export function createComplaintRouter(storageAdapter = objectStorage) {
  const router = Router();
  const resolutionController = createResolutionController(storageAdapter);
  router.use(authenticate, authorize('CITIZEN'));
  router.post('/', complaintUpload, validate(createComplaintSchema), controller.create);
  router.get('/summary', controller.summary);
  router.get('/', validate(listComplaintsSchema, 'query'), controller.list);
  router.get('/:id/timeline', validate(complaintIdSchema, 'params'), controller.timeline);
  router.get('/:id/ai-assessment', validate(complaintIdSchema, 'params'), controller.getAiAssessment);
  router.get('/:id/resolution', validate(complaintIdSchema, 'params'), resolutionController.getResolution);
  router.post('/:id/resolution-verification', validate(complaintIdSchema, 'params'),
    validate(resolutionVerificationSchema), resolutionController.submitResolutionVerification);
  router.get('/:id', validate(complaintIdSchema, 'params'), controller.getById);

  return router;
}

export default createComplaintRouter();

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { complaintUpload } from '../../middleware/complaintUpload.js';
import * as controller from './complaint.controller.js';
import { complaintIdSchema, createComplaintSchema, listComplaintsSchema } from './complaint.validation.js';

const router = Router();
router.use(authenticate, authorize('CITIZEN'));
router.post('/', complaintUpload, validate(createComplaintSchema), controller.create);
router.get('/', validate(listComplaintsSchema, 'query'), controller.list);
router.get('/:id/ai-assessment', validate(complaintIdSchema, 'params'), controller.getAiAssessment);
router.get('/:id', validate(complaintIdSchema, 'params'), controller.getById);

export default router;

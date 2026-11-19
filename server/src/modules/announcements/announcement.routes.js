import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './announcement.controller.js';
import { announcementIdSchema, announcementListQuerySchema, publishAnnouncementSchema } from './announcement.validation.js';

export function createAnnouncementRouter() {
  const router = Router();
  router.use(authenticate, authorize('CITIZEN'));
  router.get('/', validate(announcementListQuerySchema, 'query'), controller.list);
  router.get('/:id', validate(announcementIdSchema, 'params'), controller.get);
  return router;
}

export function createAdminAnnouncementRouter() {
  const router = Router();
  router.use(authenticate, authorize('ADMIN'));
  router.get('/', validate(announcementListQuerySchema, 'query'), controller.list);
  router.post('/', validate(publishAnnouncementSchema), controller.publish);
  return router;
}

export const announcementRouter = createAnnouncementRouter();
export const adminAnnouncementRouter = createAdminAnnouncementRouter();

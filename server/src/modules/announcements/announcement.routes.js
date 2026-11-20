import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as controller from './announcement.controller.js';
import {
  adminAnnouncementListQuerySchema,
  announcementIdSchema,
  announcementListQuerySchema,
  announcementPublicationSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema
} from './announcement.validation.js';

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
  router.get('/', validate(adminAnnouncementListQuerySchema, 'query'), controller.listAdmin);
  router.get('/:id', validate(announcementIdSchema, 'params'), controller.getAdmin);
  router.post('/', validate(createAnnouncementSchema), controller.create);
  router.patch('/:id', validate(announcementIdSchema, 'params'), validate(updateAnnouncementSchema), controller.update);
  router.patch('/:id/publication', validate(announcementIdSchema, 'params'), validate(announcementPublicationSchema), controller.setPublication);
  router.delete('/:id', validate(announcementIdSchema, 'params'), controller.remove);
  return router;
}

export const announcementRouter = createAnnouncementRouter();
export const adminAnnouncementRouter = createAdminAnnouncementRouter();

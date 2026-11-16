import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { loginSchema, registerSchema } from './auth.validation.js';
import * as controller from './auth.controller.js';

const router = Router();
router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.get('/me', authenticate, controller.me);
router.post('/logout', controller.logout);

export default router;

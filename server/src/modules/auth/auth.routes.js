import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { authRateLimit } from '../../middleware/authRateLimit.js';
import {
  accountDeactivationSchema, emailVerificationCompletionSchema, emailVerificationResendSchema,
  loginOtpCompletionSchema, loginSchema, passwordResetCompletionSchema,
  passwordResetRequestSchema, preferencesSchema, profileUpdateSchema, registerSchema, verificationCodeSchema
} from './auth.validation.js';
import * as controller from './auth.controller.js';
import { profileImageUpload } from '../../middleware/profileImageUpload.js';

const router = Router();
const requestWindow = 15 * 60 * 1000;
router.post('/register', authRateLimit('register', 5, requestWindow), validate(registerSchema), controller.register);
router.post('/registration/email/verify', authRateLimit('registration-verify', 20, requestWindow), validate(emailVerificationCompletionSchema), controller.completeRegistrationEmail);
router.post('/registration/email/resend', authRateLimit('registration-resend', 5, requestWindow), validate(emailVerificationResendSchema), controller.resendRegistrationEmail);
router.post('/login', authRateLimit('login', 10, requestWindow), validate(loginSchema), controller.login);
router.post('/login/otp/verify', authRateLimit('login-verify', 20, requestWindow), validate(loginOtpCompletionSchema), controller.completeLoginOtp);
router.post('/login/otp/resend', authRateLimit('login-resend', 5, requestWindow), validate(loginSchema), controller.resendLoginOtp);
router.post('/password/forgot', authRateLimit('password-reset-request', 5, requestWindow), validate(passwordResetRequestSchema), controller.requestPasswordReset);
router.post('/password/reset', authRateLimit('password-reset-complete', 20, requestWindow), validate(passwordResetCompletionSchema), controller.completePasswordReset);
router.delete('/account', authenticate, validate(accountDeactivationSchema), controller.deactivateAccount);
router.get('/me', authenticate, controller.me);
router.patch('/profile', authenticate, validate(profileUpdateSchema), controller.updateProfile);
router.post('/verification/email/send', authenticate, authRateLimit('profile-email-send', 5, requestWindow), controller.sendEmailVerification);
router.post('/verification/email/verify', authenticate, authRateLimit('profile-email-verify', 20, requestWindow), validate(verificationCodeSchema), controller.verifyEmail);
router.get('/preferences', authenticate, controller.preferences);
router.put('/preferences', authenticate, validate(preferencesSchema), controller.updatePreferences);
router.get('/profile/avatar', authenticate, controller.getProfileImageUrl);
router.post('/profile/avatar', authenticate, profileImageUpload, controller.uploadProfileImage);
router.delete('/profile/avatar', authenticate, controller.removeProfileImage);
router.post('/logout', controller.logout);

export default router;

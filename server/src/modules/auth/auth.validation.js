import { z } from 'zod';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(10).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
  message: 'Password must be at most 72 bytes'
});
const dateOfBirth = z.string().date().refine((value) => value < new Date().toISOString().slice(0, 10), {
  message: 'Date of birth must be in the past'
});
const normalizeIndianMobile = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return null;
};
const mobileNumber = z.string().trim().transform(normalizeIndianMobile).refine((value) => value && /^\+91[6-9]\d{9}$/.test(value), {
  message: 'Enter a valid 10-digit Indian mobile number'
});

export const registerSchema = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(100),
  phoneNumber: mobileNumber,
  dateOfBirth,
  address: z.string().trim().min(1).max(400)
}).strict();

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Password must be at most 72 bytes'
  })
}).strict();

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phoneNumber: z.string().trim().transform(normalizeIndianMobile).transform((value) => value || null)
    .refine((value) => !value || /^\+91[6-9]\d{9}$/.test(value), {
      message: 'Enter a valid 10-digit Indian mobile number'
    }),
  dateOfBirth: z.string().date().nullable().refine((value) => !value || value < new Date().toISOString().slice(0, 10), {
    message: 'Date of birth must be in the past'
  }),
  address: z.string().trim().max(400).transform((value) => value || null)
}).strict();

export const verificationCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Verification code must contain six digits')
}).strict();

export const emailVerificationCompletionSchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, 'Verification code must contain six digits')
}).strict();

export const loginOtpCompletionSchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, 'Verification code must contain six digits')
}).strict();

export const passwordResetRequestSchema = z.object({ email }).strict();
export const passwordResetCompletionSchema = z.object({
  email,
  code: z.string().regex(/^\d{6}$/, 'Verification code must contain six digits'),
  password
}).strict();

export const emailVerificationResendSchema = z.object({ email, password }).strict();

export const accountDeactivationSchema = z.object({
  password: z.string().min(1).max(72),
  confirmation: z.literal('DELETE')
}).strict();

export const preferencesSchema = z.object({
  language: z.enum(['en', 'ta']),
  appearance: z.enum(['light', 'dark', 'system']),
  notificationPreferences: z.object({ inApp: z.boolean(), email: z.boolean(), sms: z.boolean() }).strict(),
  accessibilityPreferences: z.object({ fontSize: z.enum(['small', 'medium', 'large']), highContrast: z.boolean(), reducedMotion: z.boolean() }).strict()
}).strict();

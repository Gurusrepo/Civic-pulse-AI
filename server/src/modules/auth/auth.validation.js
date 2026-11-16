import { z } from 'zod';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(10).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
  message: 'Password must be at most 72 bytes'
});

export const registerSchema = z.object({
  email,
  password,
  name: z.string().trim().min(1).max(100)
}).strict();

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, {
    message: 'Password must be at most 72 bytes'
  })
}).strict();

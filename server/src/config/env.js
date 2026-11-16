import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_PATH: z.string().min(1).default('./data/civicpulse.sqlite'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  CORS_ORIGINS: z.string().min(1, 'Configure at least one CORS origin'),
  SEED_EMAIL: z.string().optional(),
  SEED_PASSWORD: z.string().optional(),
  SEED_ROLE: z.enum(['OFFICER', 'ADMIN']).default('OFFICER'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SECRET_KEY: z.string().min(1, 'SUPABASE_SECRET_KEY is required'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().min(1).default('gemini-3.5-flash-lite')
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid server environment: ${details}`);
}

const origins = parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
for (const origin of origins) {
  try {
    const parsedOrigin = new URL(origin);
    if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
      throw new Error();
    }
  } catch {
    throw new Error(`Invalid CORS origin: ${origin}`);
  }
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.JWT_SECRET.includes('replace-with-')) {
  throw new Error('JWT_SECRET must be replaced before production startup');
}

export const env = Object.freeze({ ...parsed.data, CORS_ORIGINS: origins });

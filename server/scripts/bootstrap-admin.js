import 'dotenv/config';
import { z } from 'zod';
import { db, closeDatabase } from '../src/config/database.js';
import { migrateDatabase } from '../src/database/migrate.js';
import { AdminBootstrapError, bootstrapInitialAdmin } from '../src/modules/admin/bootstrap.service.js';

const bootstrapSchema = z.object({
  SEED_DISPLAY_NAME: z.string().trim().min(1).max(100),
  SEED_EMAIL: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  SEED_PASSWORD: z.string().min(12).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72)
});

const parsed = bootstrapSchema.safeParse(process.env);

try {
  if (!parsed.success) {
    throw new AdminBootstrapError(
      'Set valid SEED_DISPLAY_NAME, SEED_EMAIL, and SEED_PASSWORD values in server/.env.'
    );
  }

  migrateDatabase(db);
  await bootstrapInitialAdmin({
    displayName: parsed.data.SEED_DISPLAY_NAME,
    email: parsed.data.SEED_EMAIL,
    password: parsed.data.SEED_PASSWORD
  });

  console.log('Initial Admin account created. Email verification is required before sign-in.');
} catch (error) {
  const message = error instanceof AdminBootstrapError
    ? error.message
    : 'Initial Admin bootstrap failed; no credentials were logged.';
  console.error(message);
  process.exitCode = 1;
} finally {
  closeDatabase();
}

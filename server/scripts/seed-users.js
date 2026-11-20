import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, closeDatabase } from '../src/config/database.js';
import { migrateDatabase } from '../src/database/migrate.js';

if (process.env.NODE_ENV === 'production') {
  console.error('The development OFFICER seed command is disabled in production.');
  closeDatabase();
  process.exitCode = 1;
} else {
  const seedSchema = z.object({
    SEED_DISPLAY_NAME: z.string().trim().min(1).max(100),
    SEED_EMAIL: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    SEED_PASSWORD: z.string().min(12).max(72)
      .refine((password) => Buffer.byteLength(password, 'utf8') <= 72),
    SEED_ROLE: z.literal('OFFICER')
  });

  const parsed = seedSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Set valid SEED_DISPLAY_NAME, SEED_EMAIL, SEED_PASSWORD, and SEED_ROLE=OFFICER values in server/.env.');
    closeDatabase();
    process.exitCode = 1;
  } else {
    try {
      migrateDatabase(db);
      const passwordHash = await bcrypt.hash(parsed.data.SEED_PASSWORD, 12);
      db.prepare(`
        INSERT INTO users (display_name, email, password_hash, role) VALUES (?, ?, ?, 'OFFICER')
      `).run(parsed.data.SEED_DISPLAY_NAME, parsed.data.SEED_EMAIL, passwordHash);
      console.log('Development OFFICER account seeded.');
    } catch (error) {
      console.error(error?.code === 'SQLITE_CONSTRAINT_UNIQUE'
        ? 'An account already uses the configured seed email; no account was changed.'
        : 'OFFICER seeding failed; no credentials were logged.');
      process.exitCode = 1;
    } finally {
      closeDatabase();
    }
  }
}

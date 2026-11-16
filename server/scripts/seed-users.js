import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, closeDatabase } from '../src/config/database.js';
import { migrateDatabase } from '../src/database/migrate.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed privileged users in production.');
  process.exit(1);
}

const seedSchema = z.object({
  SEED_EMAIL: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  SEED_PASSWORD: z.string().min(12).max(72),
  SEED_ROLE: z.enum(['OFFICER', 'ADMIN'])
});
const parsed = seedSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Set valid SEED_EMAIL, SEED_PASSWORD (at least 12 characters), and SEED_ROLE in server/.env.');
  process.exit(1);
}

try {
  migrateDatabase(db);
  const passwordHash = await bcrypt.hash(parsed.data.SEED_PASSWORD, 12);
  const result = db.prepare(`
    INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, role = excluded.role,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  `).run(parsed.data.SEED_EMAIL, passwordHash, parsed.data.SEED_ROLE);
  console.log(`Provisioned ${parsed.data.SEED_ROLE} account (${parsed.data.SEED_EMAIL}); changes: ${result.changes}.`);
} catch (error) {
  console.error('Privileged user provisioning failed:', error.message);
  process.exitCode = 1;
} finally {
  closeDatabase();
}

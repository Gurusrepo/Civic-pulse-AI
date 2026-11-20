import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db as defaultDatabase } from '../../config/database.js';

const bootstrapInputSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(72)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72)
});

export class AdminBootstrapError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AdminBootstrapError';
  }
}

export async function bootstrapInitialAdmin({ displayName, email, password }, database = defaultDatabase) {
  const parsed = bootstrapInputSchema.safeParse({ displayName, email, password });
  if (!parsed.success) {
    throw new AdminBootstrapError('Initial Admin configuration is invalid.');
  }

  const { displayName: normalizedName, email: normalizedEmail, password: normalizedPassword } = parsed.data;
  const passwordHash = await bcrypt.hash(normalizedPassword, 12);

  const createAdmin = database.transaction(() => {
    const existingAdmin = database.prepare("SELECT id FROM users WHERE role='ADMIN' LIMIT 1").get();
    if (existingAdmin) {
      throw new AdminBootstrapError('An Admin account already exists; initial bootstrap is one-time.');
    }

    const existingEmail = database.prepare('SELECT id FROM users WHERE email=?').get(normalizedEmail);
    if (existingEmail) {
      throw new AdminBootstrapError('An account already uses the configured initial Admin email; no account was changed.');
    }

    const result = database.prepare(`INSERT INTO users
      (display_name,email,password_hash,role,email_verified,account_status)
      VALUES(?,?,?,'ADMIN',0,'ACTIVE')`).run(normalizedName, normalizedEmail, passwordHash);
    return { userId: Number(result.lastInsertRowid) };
  });

  try {
    return createAdmin.immediate();
  } catch (error) {
    if (error instanceof AdminBootstrapError) throw error;
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new AdminBootstrapError('An account already uses the configured initial Admin email; no account was changed.');
    }
    throw error;
  }
}

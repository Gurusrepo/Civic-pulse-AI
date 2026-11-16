import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';

const findByEmail = db.prepare('SELECT id, display_name, email, password_hash, role, created_at FROM users WHERE email = ?');
const insertCitizen = db.prepare('INSERT INTO users (display_name, email, password_hash, role) VALUES (?, ?, ?, ?)');
const publicUser = ({ id, display_name, email, role, created_at }) => ({ id, name: display_name, email, role, createdAt: created_at });

export class AuthError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function register({ email, password, name }) {
  if (findByEmail.get(email)) throw new AuthError('A user with that email already exists', 409);
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const result = insertCitizen.run(name, email, passwordHash, 'CITIZEN');
    return publicUser({ id: result.lastInsertRowid, display_name: name, email, role: 'CITIZEN', created_at: new Date().toISOString() });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw new AuthError('A user with that email already exists', 409);
    throw error;
  }
}

export async function login({ email, password }) {
  const user = findByEmail.get(email);
  const matches = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!matches) throw new AuthError('Invalid email or password', 401);
  const token = jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: String(user.id),
    expiresIn: env.JWT_EXPIRES_IN,
    issuer: 'civicpulse-api',
    audience: 'civicpulse-client'
  });
  return { user: publicUser(user), token };
}

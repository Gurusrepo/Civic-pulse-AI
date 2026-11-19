import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../config/database.js';

const findUser = db.prepare(`SELECT id, display_name AS name, email, role, created_at AS createdAt,
  profile_image_key AS profileImageKey, profile_image_mime_type AS profileImageMimeType,
  phone_number AS phoneNumber, date_of_birth AS dateOfBirth,
  date_of_birth_verification_status AS dateOfBirthVerificationStatus, address,
  email_verified AS emailVerified,
  citizen_identity_verification_status AS citizenIdentityVerificationStatus,
  account_status AS accountStatus,
  session_version AS sessionVersion FROM users WHERE id = ?`);

export function authenticate(req, res, next) {
  const token = req.cookies?.civicpulse_token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'civicpulse-api',
      audience: 'civicpulse-client'
    });
    if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }
    const user = findUser.get(Number(payload.sub));
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    if (user.accountStatus !== 'ACTIVE') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (user.role === 'CITIZEN' && !user.emailVerified) {
      return res.status(401).json({ error: 'Email verification is required' });
    }
    if ((payload.ver ?? 0) !== user.sessionVersion) return res.status(401).json({ error: 'Session is no longer valid' });
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Invalid or expired authentication token' });
    }
    next(error);
  }
}

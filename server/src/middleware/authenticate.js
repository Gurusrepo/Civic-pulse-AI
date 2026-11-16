import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { db } from '../config/database.js';

const findUser = db.prepare('SELECT id, display_name AS name, email, role FROM users WHERE id = ?');

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
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Invalid or expired authentication token' });
    }
    next(error);
  }
}

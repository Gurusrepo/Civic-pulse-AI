import { createHmac } from 'node:crypto';
import { db } from '../config/database.js';
import { env } from '../config/env.js';

const WINDOW_CLEANUP_MS = 24 * 60 * 60 * 1000;

function consumeRequest(bucket, identity, maxRequests, windowMs) {
  if (!env.OTP_SECRET) return { available: false };
  const identityHash = createHmac('sha256', env.OTP_SECRET)
    .update(`${bucket}:${identity}`)
    .digest('hex');
  const now = Date.now();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM auth_request_rate_limits WHERE window_started_at < ?')
      .run(now - WINDOW_CLEANUP_MS);
    const existing = db.prepare(`SELECT window_started_at,request_count FROM auth_request_rate_limits
      WHERE bucket=? AND identity_hash=?`).get(bucket, identityHash);
    if (!existing || now - existing.window_started_at >= windowMs) {
      db.prepare(`INSERT INTO auth_request_rate_limits(bucket,identity_hash,window_started_at,request_count)
        VALUES(?,?,?,1) ON CONFLICT(bucket,identity_hash) DO UPDATE SET
        window_started_at=excluded.window_started_at,request_count=1`)
        .run(bucket, identityHash, now);
      return { allowed: true };
    }
    if (existing.request_count >= maxRequests) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - existing.window_started_at)) / 1000)) };
    }
    db.prepare(`UPDATE auth_request_rate_limits SET request_count=request_count+1
      WHERE bucket=? AND identity_hash=?`).run(bucket, identityHash);
    return { allowed: true };
  });
  return { available: true, ...transaction.immediate() };
}

export function authRateLimit(bucket, maxRequests, windowMs) {
  return (req, res, next) => {
    try {
      const requestLimit = env.NODE_ENV === 'test' ? maxRequests * 1000 : maxRequests;
      const result = consumeRequest(bucket, req.ip || req.socket.remoteAddress || 'unknown', requestLimit, windowMs);
      if (!result.available) return res.status(503).json({ error: 'OTP security is not configured' });
      if (!result.allowed) {
        res.set('Retry-After', String(result.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import complaintRoutes from './modules/complaints/complaint.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
const allowedOrigins = new Set(env.CORS_ORIGINS);

app.disable('x-powered-by');
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  }
}));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('Origin');
    if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'Origin not allowed' });
    if (!origin && req.get('Sec-Fetch-Site') && req.get('Sec-Fetch-Site') !== 'same-origin') {
      return res.status(403).json({ error: 'Request origin could not be verified' });
    }
  }
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;

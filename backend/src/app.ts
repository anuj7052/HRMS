import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/database';
import authRoutes from './routes/auth';
import employeeRoutes from './routes/employees';
import deviceRoutes from './routes/devices';
import attendanceRoutes from './routes/attendance';
import leaveRoutes from './routes/leaves';
import reportRoutes from './routes/reports';
import settingsRoutes from './routes/settings';
import iclockRoutes from './routes/iclock';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Trust Azure App Service / reverse proxy (fixes express-rate-limit X-Forwarded-For warning)
app.set('trust proxy', 1);

// Connect to MongoDB (non-fatal if unavailable — Prisma/PG is primary)
connectDB().catch((err) => console.warn('[MongoDB] Connection skipped:', err.message));

// Security middleware
app.use(helmet());

// Allow the web app, Expo web, Expo Go on a LAN, and any explicitly-configured origin.
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
];
const EXTRA_ORIGINS = (process.env.CLIENT_URL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set<string>([...DEFAULT_DEV_ORIGINS, ...EXTRA_ORIGINS]);
// Match LAN IPs on common dev ports (Vite 5173, Metro 8081, Expo 19006).
const LAN_ORIGIN_REGEX = /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:(5173|8081|19006|5000))?$/;

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / curl / native apps with no Origin header.
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.has(origin) || LAN_ORIGIN_REGEX.test(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth requests, please try again later.' },
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

// iClock device push receiver — no auth middleware (device uses this directly)
// Configure your biometric device's Server URL to: http://<your-server-ip>:5000
app.use('/iclock', iclockRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;

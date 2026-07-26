import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';
import morgan from 'morgan';
import apiRoutes, { verifySocketTicket } from './routes/api';
import donorStatsRoutes from './routes/donorStats';
import { startSosSweeper, stopSosSweeper } from './services/sosSweeper';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === 'production';

// ─── Fail fast on missing configuration ──────────────────────────────────────
// In production a missing secret must crash the process at boot, not surface as
// a broken request later. In dev we only warn so local work stays frictionless.
function validateEnv() {
  const required: Record<string, string | undefined> = {
    JWT_SECRET: process.env.JWT_SECRET,
    MONGODB_URI: process.env.MONGODB_URI,
    FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
    AI_SERVICE_URL: process.env.AI_SERVICE_URL,
    AI_SERVICE_API_KEY: process.env.AI_SERVICE_API_KEY,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v || !String(v).trim())
    .map(([k]) => k);

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    missing.push('JWT_SECRET (must be at least 32 characters)');
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (isProduction) {
      throw new Error(message);
    }
    console.warn(`⚠️  ${message}. Using dev defaults where possible.`);
  }
}
validateEnv();

// ─── CORS origins ─────────────────────────────────────────────────────────────
const defaultOrigins = ['http://localhost:3000', 'http://localhost:3010'];
const configuredOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',').map((o) => o.trim()).filter(Boolean);
if (isProduction && configuredOrigins.length === 0) {
  throw new Error('FRONTEND_ORIGIN must be configured in production.');
}
const allowedOrigins = Array.from(new Set(isProduction ? configuredOrigins : [...defaultOrigins, ...configuredOrigins]));

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
});

// ─── Security headers ─────────────────────────────────────────────────────────
// This service returns JSON (and Socket.IO), never HTML pages, so the safest
// Content-Security-Policy is to forbid loading any resource. It still hardens
// any error/HTML surface and blocks clickjacking + <base> injection.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  hsts: isProduction ? { maxAge: 15552000, includeSubDomains: true } : false,
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  credentials: true,
}));

// ─── Attach socket.io to every request ───────────────────────────────────────
app.use((req, res, next) => { (req as any).io = io; next(); });
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// HTTP request logging — Apache-style 'combined' in production, concise in dev.
app.use(morgan(isProduction ? 'combined' : 'dev'));

// ─── Health check (reports real MongoDB connectivity) ────────────────────────
// readyState: 1 = connected. A load balancer must not route traffic here when
// the database is down, so we return 503 unless Mongo is actually connected.
app.get('/', (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    service: 'ThalAI Connect API',
    version: '1.0.0',
    db: dbConnected ? 'connected' : 'disconnected',
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);
app.use('/api/donor', donorStatsRoutes);

// ─── 404 for unknown routes (JSON, not Express's HTML default) ────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler — must be last, must have 4 args ───────────────────
// Catches thrown/async errors so they never leak stack traces or crash the
// process. Full error is logged server-side; the client gets a safe message.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof err?.status === 'number' ? err.status : 500;
  logger.error('Unhandled request error', {
    method: req.method,
    path: req.path,
    status,
    error: err instanceof Error ? err.stack : String(err),
  });
  if (res.headersSent) return;
  res.status(status).json({
    error: isProduction ? 'Internal server error' : (err?.message || 'Internal server error'),
  });
});

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const ATLAS_URI = (process.env.MONGODB_URI || '').trim();
const LOCAL_URI = 'mongodb://127.0.0.1:27017/thaiconnect';

mongoose.set('strictQuery', true);

async function connectDB() {
  if (ATLAS_URI) {
    try {
      await mongoose.connect(ATLAS_URI, { serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 });
      console.log('✅ Connected to MongoDB Atlas');
      return;
    } catch (error) {
      if (isProduction) {
        throw error;
      }
      console.warn('⚠️  Atlas connection failed. Falling back to local MongoDB...');
    }
  }

  if (isProduction) {
    throw new Error('MONGODB_URI must be configured in production.');
  }

  try {
    await mongoose.connect(LOCAL_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to local MongoDB:', LOCAL_URI);
  } catch (error) {
    console.error('❌ Could not connect to any MongoDB instance.');
    throw error;
  }
}

void connectDB().catch((error) => {
  console.error('Database startup failed:', error instanceof Error ? error.message : error);
  if (isProduction) {
    process.exit(1);
  }
});

mongoose.connection.on('error', (err) => console.error('Mongoose error:', err.message));
// Start the persistent SOS escalation sweeper once the DB is available.
mongoose.connection.once('open', () => startSosSweeper());

// ─── Socket.IO authentication ─────────────────────────────────────────────────
// Every socket must present a valid short-lived ticket (minted by the
// authenticated /api/auth/socket-ticket endpoint). We derive the user id from
// the verified ticket — never from client input — so nobody can join another
// user's room and eavesdrop on their SOS/medical notifications.
io.use((socket, next) => {
  const ticket =
    (socket.handshake.auth && (socket.handshake.auth as any).token) ||
    (socket.handshake.query && (socket.handshake.query as any).token);
  const identity = typeof ticket === 'string' ? verifySocketTicket(ticket) : null;
  if (!identity) {
    return next(new Error('Unauthorized socket connection'));
  }
  (socket.data as any).userId = identity.id;
  (socket.data as any).role = identity.role;
  return next();
});

// ─── Socket.IO events ─────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const userId = (socket.data as any).userId as string;
  // Bind the socket to its own verified room immediately — the client no longer
  // tells us which room to join.
  socket.join(userId);
  console.log(`Socket connected: ${socket.id} (user ${userId})`);

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

// ─── Start server on fixed PORT (issue #21/#22 — no dynamic port scanning) ───
// Backend is always on PORT (default 5002). AI service is always on 5001.
// Set PORT=5002 in .env (already configured).
const PORT = Number(process.env.PORT || 5002);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be a valid TCP port number.');
}

httpServer.listen(PORT, () => {
  logger.info('Server started', { port: PORT, env: process.env.NODE_ENV || 'development' });
});

const shutdown = (signal: NodeJS.Signals) => {
  logger.info('Shutting down gracefully', { signal });
  stopSosSweeper();
  // Force-exit if a graceful close hangs (e.g. a stuck connection) so deploy
  // platforms (Render/K8s) aren't left waiting on the process forever.
  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10000);
  forceExit.unref();
  io.close();
  httpServer.close(() => {
    mongoose.connection.close(false).finally(() => {
      clearTimeout(forceExit);
      process.exit(0);
    });
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');

const logger = require('./utils/logger');
const { apiLimiter, authLimiter } = require('./utils/rateLimiter');
const { errorHandler } = require('./utils/errorHandler');

// ── Environment Validation ────────────────────────────────────
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'FRONTEND_URL'];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    // FRONTEND_URL is mandatory in production to ensure CORS security
    if (process.env.NODE_ENV === 'production' || ['MONGODB_URI', 'JWT_SECRET'].includes(envVar)) {
      logger.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }
});

const app    = express();
app.set('trust proxy', 1); // Ensure rate limiting works correctly on Cloud/Heroku

const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────
// Normalize FRONTEND_URL: Trim whitespace and handle fallbacks
const rawFrontendUrl = process.env.FRONTEND_URL?.trim();
const allowedOrigins = [
  rawFrontendUrl,
  'http://localhost:5173',
  'http://localhost:3000',
  /\.vercel\.app$/i,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) return allowed.test(origin);
      // Robust comparison: Ignore trailing slashes in both URL and origin
      return origin.replace(/\/$/, '') === allowed.replace(/\/$/, '');
    });
    
    if (!isAllowed) {
      logger.warn(`CORS blocked for origin: ${origin}`);
      return callback(new Error('CORS not allowed'));
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});
io.activeBookings = new Map(); // FIX: Initialize tracking map to prevent undefined errors in routes
global.io = io;
require('./socket/index')(io);

// ── Global Middleware ─────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(mongoSanitize()); // Prevent NoSQL Injection
app.use(compression());   // Improve performance via response compression
app.use(cors(corsOptions));
logger.info('CORS and Socket.io initialized with whitelist:', { 
  primary: rawFrontendUrl || 'Default Localhost',
  totalRules: allowedOrigins.length 
});

app.use(express.json({ limit: '10kb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Rate Limiting ─────────────────────────────────────────────
app.use('/api/', apiLimiter);
app.use('/api/auth/login',     authLimiter);
app.use('/api/admin/login',    authLimiter); // BUG FIX #6: Protect admin login
app.use('/api/driver/register', authLimiter); // FIX: Prevent driver registration spam
logger.info('Rate limiting enabled on all API routes');

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/driver',   require('./routes/driver'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/buses',    require('./routes/buses'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/fare',     require('./routes/fare'));
app.use('/api/payments', require('./routes/payments')); // FIX: Mount missing payments route
app.use('/api/rides',    require('./routes/rides'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:   'ok',
    service:  'MoveOn Go API',
    version:  '1.0.0',
    uptime:   Math.floor(process.uptime()),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ── Serve Frontend (Production) ───────────────────────────────
const path = require('path');
const frontendBuildPath = path.join(__dirname, '../frontend/dist');

// Serve static assets (JS, CSS, images, etc.)
app.use(express.static(frontendBuildPath));

// For any non-API request that doesn't match a real file, serve index.html
// This enables React Router to handle client-side routing
app.get('*', (req, res, next) => {
  // Skip if this is an API request (it will hit the 404 handler below)
  if (req.path.startsWith('/api/') || req.path === '/health') {
    return next();
  }
  
  const indexPath = path.join(frontendBuildPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.warn(`Failed to serve frontend: ${err.message}`);
      next();
    }
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn(`Route not found: ${req.method} ${req.path}`);
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
});

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    logger.info('MongoDB connected ✅');
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} ✅`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err) => {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  });

// ── Graceful Shutdown ─────────────────────────────────────────
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    logger.info('Server closed');
    mongoose.connection.close();
    logger.info('Database connection closed');
    process.exit(0);
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after 30 seconds');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');

const logger = require('./utils/logger');
const { apiLimiter, authLimiter } = require('./utils/rateLimiter');
const { errorHandler } = require('./utils/errorHandler');

// ── Environment Validation ────────────────────────────────────
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
});

const app    = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────
const allowedOrigins = [
  // Production
  process.env.FRONTEND_URL || 'http://localhost:5173',
  // Development
  'http://localhost:5173',
  'http://localhost:3000',
  // Allow any Vercel deployment (*.vercel.app)
  /\.vercel\.app$/i,
];

const io = new Server(server, {
  cors: { 
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return origin === allowed;
      });
      
      callback(null, isAllowed);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});
global.io = io;
require('./socket/index')(io);
logger.info('Socket.io initialized with CORS whitelist:', { origins: allowedOrigins });

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ 
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed instanceof RegExp) {
        return allowed.test(origin);
      }
      return origin === allowed;
    });
    
    if (!isAllowed) {
      return callback(new Error('CORS not allowed'));
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
logger.info('CORS configured for origins:', { origins: allowedOrigins });

app.use(express.json({ limit: '10kb' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ── Rate Limiting ─────────────────────────────────────────────
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
logger.info('Rate limiting enabled on all API routes');

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/driver',   require('./routes/driver'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/buses',    require('./routes/buses'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/fare',     require('./routes/fare'));
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

require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');

const app    = express();
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
});
global.io = io;
require('./socket/index')(io);

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(morgan('dev'));

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

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ message: err.message });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('[DB] MongoDB connected ✅');
    server.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT} ✅`);
      console.log(`[Server] Health: http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error('[DB] MongoDB connection failed:', err.message);
    process.exit(1);
  });

process.on('SIGTERM', () => {
  server.close(() => { mongoose.connection.close(); process.exit(0); });
});

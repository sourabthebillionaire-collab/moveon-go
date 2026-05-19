const router = require('express').Router();
const logger = require('../utils/logger');

// Dev-only debug endpoint to simulate booking socket events.
// POST /api/debug/emit-booking { bookingId, action, driverId, driver }
router.post('/emit-booking', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ message: 'Debug endpoints are disabled in production.' });
  }
  const { bookingId, action, driverId, driver } = req.body || {};
  if (!bookingId || !action) return res.status(400).json({ message: 'bookingId and action required' });
  const payload = { action, bookingId: String(bookingId), driverId: driverId ? String(driverId) : undefined, driver: driver || undefined };
  if (global.io) {
    logger.info(`Debug emit booking:${bookingId}`, { payload });
    global.io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, payload);
    global.io.emit(`booking:${bookingId}`, payload);
    return res.json({ ok: true, payload });
  }
  res.status(500).json({ message: 'Socket server not initialized' });
});

module.exports = router;

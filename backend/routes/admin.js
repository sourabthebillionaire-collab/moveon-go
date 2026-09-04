/**
 * Admin Routes — protected by admin password
 * POST /api/admin/login              → admin login
 * GET  /api/admin/stats              → dashboard numbers
 * GET  /api/admin/drivers            → all drivers (filter by status)
 * GET  /api/admin/drivers/pending    → pending approvals
 * PUT  /api/admin/drivers/:id/approve → approve driver
 * PUT  /api/admin/drivers/:id/reject  → reject driver
 * DELETE /api/admin/drivers/:id      → delete driver
 * GET  /api/admin/users              → all users
 * GET  /api/admin/bookings           → all bookings
 */

const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { Driver, User, Booking, BusRoute } = require('../models');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pujasarkar';
const JWT_SECRET     = process.env.JWT_SECRET;

// ── Statistics Cache ──────────────────────────────────────────
const statsCache = new Map();
const CACHE_TTL = 30000; // 30 seconds in milliseconds

// ── Admin auth middleware ─────────────────────────────────────
function adminAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Admin not authenticated.' });
    }
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.type !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired admin token.' });
  }
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: 'Incorrect admin password.' });
  }
  const token = jwt.sign({ type: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ message: 'Admin signed in.', token });
});

// GET /api/admin/stats
router.get('/stats', adminAuth, asyncHandler(async (req, res) => {
    const { type } = req.query;
    const cacheKey = type || 'all';
    const now = Date.now();

    // Check if valid cache exists for this specific filter type
    if (statsCache.has(cacheKey) && (now - statsCache.get(cacheKey).ts < CACHE_TTL)) {
      return res.json(statsCache.get(cacheKey).data);
    }

    const filter = type && type !== 'all' ? { vehicleType: type } : {};

    const [
      totalUsers,
      totalDrivers,
      pendingDrivers,
      activeDrivers,
      totalBookings,
      completedBookings,
      todayBookings,
      sosAlerts,
    ] = await Promise.all([
      User.countDocuments(),
      Driver.countDocuments({ ...filter, isActive: true }),
      Driver.countDocuments({ ...filter, isApproved: false, isActive: true }),
      Driver.countDocuments({ ...filter, onDuty: true, isActive: true }),
      Booking.countDocuments({ ...filter, status: { $ne: 'cancelled' } }), 
      Booking.countDocuments({ ...filter, status: 'completed' }),
      Booking.countDocuments({ ...filter, createdAt: { $gte: new Date(new Date().setUTCHours(0,0,0,0)) } }),
      Driver.countDocuments({ ...filter, status: 'SOS', isActive: true }),
    ]);

    const statsData = {
      totalUsers,
      totalDrivers,
      pendingDrivers,
      activeDrivers,
      totalBookings,
      completedBookings,
      todayBookings,
      sosAlerts,
    };

    // Update cache before responding
    statsCache.set(cacheKey, { ts: now, data: statsData });

    res.json(statsData);
}));

// GET /api/admin/drivers?status=pending|approved|sos|all&type=bus|auto|cab&id=ID
router.get('/drivers', adminAuth, asyncHandler(async (req, res) => {
    const { status, type, q, id } = req.query;
    let query = { isActive: true };

    if (id) {
      query._id = id;
    } else {
      if (status === 'pending')  query.isApproved = false;
      if (status === 'approved') query.isApproved = true;
      if (status === 'sos')      query.status = 'SOS';
      if (type && type !== 'all') query.vehicleType = type;
    }

    if (q) {
      const regex = new RegExp(q, 'i');
      query.$or = [
        { name: regex },
        { vehicleNumber: regex },
        { vehicleId: regex }
      ];
    }

    const drivers = await Driver.find(query)
      .select('-pinHash')
      .sort({ createdAt: -1 });

    res.json({ drivers, count: drivers.length });
}));

// PUT /api/admin/drivers/:id/approve
router.put('/drivers/:id/approve', adminAuth, asyncHandler(async (req, res) => {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { isApproved: true, isActive: true },
      { new: true }
    ).select('-pinHash');

    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    statsCache.clear(); // FIX: Invalidate statistics cache for immediate UI feedback

    if (global.io) {
      // ✅ Targeted notification: only notify the specific vehicle room
      const vRoom = `vehicle:${driver.vehicleId}`;
      global.io.to(vRoom).emit('driver:approved', { 
        driverId: String(driver._id), 
        vehicleId: driver.vehicleId 
      });
      
      // ✅ Cleanup: Force unapproved connections to leave the temporary vehicle room
      global.io.in(vRoom).socketsLeave(vRoom);
    }

    res.json({ message: `Driver ${driver.name} approved. Vehicle ID: ${driver.vehicleId}`, driver });
}));

// PUT /api/admin/drivers/:id/reject
router.put('/drivers/:id/reject', adminAuth, asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { isActive: false, onDuty: false, status: 'offline' }, // FIX: Ensure status is synced in DB
      { new: true }
    ).select('-pinHash');

    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    statsCache.clear(); // FIX: Invalidate statistics cache for immediate UI feedback

    // ✅ Kick driver off active session immediately
    if (global.io) {
      const driverRoom = `driver:${req.params.id}`;
      const vehicleRoom = `vehicle:${driver.vehicleId}`;

      // Notify unapproved driver if they are still on the ID screen
      global.io.to(vehicleRoom).emit('driver:kicked', { reason: reason || 'Registration rejected.' });
      global.io.in(vehicleRoom).socketsLeave(vehicleRoom);

      // FIX: Notify rider if driver was on a trip
      if (global.io.driverToBooking) {
        const bookingId = global.io.driverToBooking.get(String(req.params.id));
        if (bookingId) {
            const room = `booking:${bookingId}`;
            global.io.to(room).emit(room, {
              action: 'cancelled',
              message: 'Your ride was cancelled due to a driver account issue.',
              bookingId
            });
            global.io.in(room).socketsLeave(room);
            
            // FIX: Ensure arrived notifications are also cleared
            if (global.io.arrivedNotified) {
              global.io.arrivedNotified.delete(bookingId);
            }
            global.io.activeBookings.delete(bookingId);
            global.io.driverToBooking.delete(String(req.params.id));
            logger.info(`Admin rejected driver ${req.params.id} — aborted active booking ${bookingId}`);
          }
        }

        global.io.to(driverRoom).emit('driver:kicked', {
          reason: reason || 'Your account has been rejected by admin.',
        });

        // ✅ REAL-TIME SYNC: Remove from map and notify all riders immediately
        global.io.activeVehiclePositions?.delete(String(req.params.id));
        global.io.emit('driver:offline', { driverId: req.params.id });
        
        global.io.in(driverRoom).socketsLeave(driverRoom);
      }

    res.json({ message: `Driver ${driver.name} rejected.`, driver });
}));

// PUT /api/admin/drivers/:id/clear-sos
// Allows admins to manually resolve an emergency status
router.put('/drivers/:id/clear-sos', adminAuth, asyncHandler(async (req, res) => {
    const driverId = req.params.id;
    // Determine restorative status: busy if mid-trip, otherwise active
    const bookingId = global.io?.driverToBooking?.get(String(driverId));
    const nextStatus = bookingId ? 'busy' : 'active';

    const driver = await Driver.findByIdAndUpdate(
      driverId,
      { status: nextStatus },
      { new: true }
    ).select('-pinHash');

    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    logger.info(`Admin cleared SOS for driver ${driverId}. Status restored to ${nextStatus}`);

    statsCache.clear(); // FIX: Invalidate statistics cache for immediate UI feedback

    if (global.io) {
      // Notify admins to refresh stats and dashboard alerts
      global.io.to('admins').emit('admin:driverUpdated', { driverId, action: 'sos_cleared' });

      // Update the real-time map entry
      const currentPos = global.io.activeVehiclePositions.get(String(driverId));
      if (currentPos) {
        currentPos.status = nextStatus;
        currentPos.ts = Date.now();
        global.io.emit('vehicles:update', currentPos);
      }
    }

    res.json({ message: `SOS status cleared for ${driver.name}.`, driver });
}));

// DELETE /api/admin/drivers/:id  ✅ NOW KICKS DRIVER INSTANTLY
router.delete('/drivers/:id', adminAuth, asyncHandler(async (req, res) => {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    statsCache.clear(); // FIX: Invalidate statistics cache for immediate UI feedback

    // ✅ Emit kick event to that driver's socket room instantly
    // Driver.jsx listens for this and clears session + redirects to login
    if (global.io) {
      const driverRoom = `driver:${req.params.id}`;

      // ✅ REAL-TIME SYNC: Remove from map and notify all riders immediately
      global.io.activeVehiclePositions?.delete(String(req.params.id));
      global.io.emit('driver:offline', { driverId: req.params.id });

      if (global.io.driverToBooking) {
        const bookingId = global.io.driverToBooking.get(String(req.params.id));
        if (bookingId) {
            const room = `booking:${bookingId}`;
            global.io.to(room).emit(room, {
              action: 'cancelled',
              message: 'Your driver is no longer available.',
              bookingId
            });
            global.io.in(room).socketsLeave(room);
            
            if (global.io.arrivedNotified) {
              global.io.arrivedNotified.delete(bookingId);
            }
            global.io.activeBookings.delete(bookingId);
            global.io.driverToBooking.delete(String(req.params.id));
            logger.info(`Admin deleted driver ${req.params.id} — aborted active booking ${bookingId}`);
          }
        }

        global.io.to(driverRoom).emit('driver:kicked', {
          reason: 'Your account has been removed by admin.',
        });
        // FIX: Force socket to leave room to prevent memory bloat
        global.io.in(driverRoom).socketsLeave(driverRoom);
      }

    res.json({ message: `Driver ${driver.name} deleted.` });
}));

// GET /api/admin/users
router.get('/users', adminAuth, asyncHandler(async (req, res) => {
    const users = await User.find().sort({ createdAt: -1 }).select('-__v');
    res.json({ users, count: users.length });
}));

// GET /api/admin/bookings
router.get('/bookings', adminAuth, asyncHandler(async (req, res) => {
    const bookings = await Booking.find()
      .populate('userId', 'phone name')
      .populate('driverId', 'name vehicleNumber vehicleType')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ bookings, count: bookings.length });
}));

module.exports = router;

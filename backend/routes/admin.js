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
const { asyncHandler } = require('../utils/errorHandler');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pujasarkar';
const JWT_SECRET     = process.env.JWT_SECRET;

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
    const [
      totalUsers,
      totalDrivers,
      pendingDrivers,
      activeDrivers,
      totalBookings,
      completedBookings,
      todayBookings,
    ] = await Promise.all([
      User.countDocuments(),
      Driver.countDocuments({ isActive: true }),
      Driver.countDocuments({ isApproved: false, isActive: true }),
      Driver.countDocuments({ onDuty: true, isActive: true }),
      Booking.countDocuments({ status: { $ne: 'cancelled' } }), // Exclude cancelled bookings from total
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ createdAt: { $gte: new Date(new Date().setUTCHours(0,0,0,0)) } }),
    ]);

    res.json({
      totalUsers,
      totalDrivers,
      pendingDrivers,
      activeDrivers,
      totalBookings,
      completedBookings,
      todayBookings,
    });
}));

// GET /api/admin/drivers?status=pending|approved|all
router.get('/drivers', adminAuth, asyncHandler(async (req, res) => {
    const { status } = req.query;
    let query = { isActive: true };
    if (status === 'pending')  query.isApproved = false;
    if (status === 'approved') query.isApproved = true;

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

    if (global.io) {
      global.io.emit('driver:approved', { driverId: driver._id, vehicleId: driver.vehicleId });
    }

    res.json({ message: `Driver ${driver.name} approved. Vehicle ID: ${driver.vehicleId}`, driver });
}));

// PUT /api/admin/drivers/:id/reject
router.put('/drivers/:id/reject', adminAuth, asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-pinHash');

    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    // ✅ Kick driver off active session immediately
    if (global.io) {
      // FIX: Notify rider if driver was on a trip
      if (global.io.driverToBooking) {
        const bookingId = global.io.driverToBooking.get(String(req.params.id));
        if (bookingId) {
            const room = `booking:${bookingId}`;
            global.io.to(room).emit(room, {
              action: 'booking:statusUpdate', // Use a distinct event name
              message: 'Your ride was cancelled due to a driver account issue.'
            });
            global.io.in(room).socketsLeave(room);
            global.io.activeBookings.delete(bookingId);
            global.io.driverToBooking.delete(String(req.params.id));
            logger.info(`Admin rejected driver ${req.params.id} — aborted active booking ${bookingId}`);
      }
    }

      global.io.to(`driver:${req.params.id}`).emit('driver:kicked', {
        reason: reason || 'Your account has been rejected by admin.',
      });
      // FIX: Force socket to leave room
      global.io.in(`driver:${req.params.id}`).socketsLeave(`driver:${req.params.id}`);
    }

    res.json({ message: `Driver ${driver.name} rejected.`, driver });
}));

// DELETE /api/admin/drivers/:id  ✅ NOW KICKS DRIVER INSTANTLY
router.delete('/drivers/:id', adminAuth, asyncHandler(async (req, res) => {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    // ✅ Emit kick event to that driver's socket room instantly
    // Driver.jsx listens for this and clears session + redirects to login
    if (global.io) {
      const driverRoom = `driver:${req.params.id}`;
      // FIX: Notify rider if driver was on a trip
      if (global.io.driverToBooking) {
        const bookingId = global.io.driverToBooking.get(String(req.params.id));
        if (bookingId) {
            const room = `booking:${bookingId}`;
            global.io.to(room).emit(room, {
              action: 'booking:statusUpdate', // Use a distinct event name
              message: 'Your driver is no longer available.'
            });
            global.io.in(room).socketsLeave(room);
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

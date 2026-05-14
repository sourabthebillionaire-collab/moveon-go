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
router.get('/stats', adminAuth, async (req, res) => {
  try {
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
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
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
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch stats.' });
  }
});

// GET /api/admin/drivers?status=pending|approved|all
router.get('/drivers', adminAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let query = { isActive: true };
    if (status === 'pending')  query.isApproved = false;
    if (status === 'approved') query.isApproved = true;

    const drivers = await Driver.find(query)
      .select('-pinHash')
      .sort({ createdAt: -1 });

    res.json({ drivers, count: drivers.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch drivers.' });
  }
});

// PUT /api/admin/drivers/:id/approve
router.put('/drivers/:id/approve', adminAuth, async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { new: true }
    ).select('-pinHash');

    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    if (global.io) {
      global.io.emit('driver:approved', { driverId: driver._id, vehicleId: driver.vehicleId });
    }

    res.json({ message: `Driver ${driver.name} approved. Vehicle ID: ${driver.vehicleId}`, driver });
  } catch (err) {
    res.status(500).json({ message: 'Failed to approve driver.' });
  }
});

// PUT /api/admin/drivers/:id/reject
router.put('/drivers/:id/reject', adminAuth, async (req, res) => {
  try {
    const { reason } = req.body;
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-pinHash');

    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    // ✅ Kick driver off active session immediately
    if (global.io) {
      global.io.to(`driver:${req.params.id}`).emit('driver:kicked', {
        reason: reason || 'Your account has been rejected by admin.',
      });
    }

    res.json({ message: `Driver ${driver.name} rejected.`, driver });
  } catch (err) {
    res.status(500).json({ message: 'Failed to reject driver.' });
  }
});

// DELETE /api/admin/drivers/:id  ✅ NOW KICKS DRIVER INSTANTLY
router.delete('/drivers/:id', adminAuth, async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    // ✅ Emit kick event to that driver's socket room instantly
    // Driver.jsx listens for this and clears session + redirects to login
    if (global.io) {
      global.io.to(`driver:${req.params.id}`).emit('driver:kicked', {
        reason: 'Your account has been removed by admin.',
      });
    }

    res.json({ message: `Driver ${driver.name} deleted.` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete driver.' });
  }
});

// GET /api/admin/users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 }).select('-__v');
    res.json({ users, count: users.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// GET /api/admin/bookings
router.get('/bookings', adminAuth, async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('userId', 'phone name')
      .populate('driverId', 'name vehicleNumber vehicleType')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ bookings, count: bookings.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings.' });
  }
});

module.exports = router;

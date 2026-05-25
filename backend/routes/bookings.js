const router  = require('express').Router();
const { Booking, Driver } = require('../models');
const { protect, protectDriver } = require('../middleware/auth');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');
const { bookingLimiter } = require('../utils/rateLimiter');
const crypto = require('crypto');

// POST /api/bookings — rider creates a booking
router.post('/', protect, bookingLimiter, asyncHandler(async (req, res) => {
  const {
    type, pickup, pickupCoords, dropoff, dropoffCoords,
    fare, fareAmount, payment, distance, duration,
    // FIX: Accept and persist Razorpay payment fields.
    // BookRide.jsx sends these after checkout — previously discarded silently.
    razorpayOrderId, razorpayPaymentId, razorpaySignature, paid,
  } = req.body;

  if (!type || !pickup || !dropoff || !pickupCoords || !dropoffCoords || !payment) {
    logger.warn('Booking creation: missing required fields', { userId: req.user._id });
    return res.status(400).json({ message: 'Missing required booking fields.' });
  }

  // FIX: Validate that coords are real numeric lat/lng before storing.
  const isValidCoord = (c) =>
    c && 
    typeof c.lat === 'number' && 
    typeof c.lng === 'number' &&
    Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;

  if (!isValidCoord(pickupCoords) || !isValidCoord(dropoffCoords)) {
    logger.warn('Booking creation: invalid coordinates', { userId: req.user._id });
    return res.status(400).json({ message: 'Invalid pickup or drop-off coordinates.' });
  }

  // ✅ SECURITY HARDENING: Mandate verification for Online payments
  let isActuallyPaid = false;
  if (payment === 'Online') {
    if (!razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: 'Online payment verification failed: Details missing.' });
    }
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const hmac = crypto.createHmac('sha256', secret || '');
    hmac.update(razorpayOrderId + "|" + razorpayPaymentId);
    const generated = hmac.digest('hex');
    if (generated === razorpaySignature) {
      isActuallyPaid = true;
    } else {
      return res.status(400).json({ message: 'Invalid payment signature. Booking rejected.' });
    }
  }

  const amount = (fareAmount !== undefined && fareAmount !== null) ? fareAmount : 50;
  
  // Ola/Uber Style: Generate a 4-digit OTP for the passenger to give to the driver
  // This ensures the ride only starts when the passenger is physically present.
  const startOTP = Math.floor(1000 + Math.random() * 9000).toString();

  const booking = await Booking.create({
    userId:      req.user._id,
    vehicleType: type,
    pickup,      dropoff,
    pickupLat:   pickupCoords.lat,
    pickupLng:   pickupCoords.lng,
    dropoffLat:  dropoffCoords.lat,
    dropoffLng:  dropoffCoords.lng,
    fare, fareAmount: amount,
    payment: payment || 'Cash',
    distance, duration,
    status: 'searching',
    startOTP, // Persist OTP
    // Payment tracking
    paid:              isActuallyPaid,
    razorpayOrderId:   razorpayOrderId   || null,
    razorpayPaymentId: razorpayPaymentId || null,
    razorpaySignature: razorpaySignature || null,
  });

  logger.info(`Booking created: ${booking._id}`, { userId: req.user._id, type, fareAmount: amount });

  if (global.io) {
    // ✅ PERFORMANCE: Target only drivers of the requested vehicle type
    global.io.to(`drivers:${type}`).emit('ride:request', {
      id:         booking._id,
      type,       pickup,      dropoff,
      fare,       fareAmount:  amount,
      distance,   duration,
      pickupLat:  pickupCoords.lat,
      pickupLng:  pickupCoords.lng,
      dropoffLat: dropoffCoords.lat,
      dropoffLng: dropoffCoords.lng,
    });
  }

  res.status(201).json({
    message: 'Booking created. Searching for drivers...',
    booking: { 
      id:       booking._id, 
      status:   booking.status,
      otp:      startOTP, // Return OTP to the rider
      fare:     amount,
      currency: 'INR'
    },
  });
}));

// GET /api/bookings — rider's booking history
router.get('/', protect, asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .limit(20);
  logger.info(`Bookings fetched: ${bookings.length} found`, { userId: req.user._id });
  res.json({ bookings });
}));

// GET /api/bookings/active — rider's active booking
router.get('/active', protect, asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({
    userId: req.user._id,
    status: { $in: ['searching', 'accepted', 'started'] },
  }).populate('driverId', 'name phone vehicleNumber rating vehicleType');

  logger.info(`Active booking query`, { userId: req.user._id, found: !!booking });
  res.json({ booking: booking || null });
}));

// GET /api/bookings/driver-active — driver's currently assigned booking
// FIX: Used by Driver.jsx session restore to verify localStorage ride is
// still valid. Without this, stale rides cause "Failed to start the ride".
router.get('/driver-active', protectDriver, asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({
    driverId: req.driver._id,
    status:   { $in: ['accepted', 'started'] },
  }).select('_id status pickup dropoff fare fareAmount distance duration pickupLat pickupLng dropoffLat dropoffLng vehicleType payment').lean();

  logger.info(`Driver active booking query`, { driverId: req.driver._id, found: !!booking });
  res.json({ booking: booking || null });
}));

// DELETE /api/bookings/:id — rider cancels booking
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, status: { $in: ['searching', 'accepted'] } },
    { status: 'cancelled' },
    { new: true }
  );

  if (!booking) {
    logger.warn(`Booking cancel: not found`, { bookingId: req.params.id, userId: req.user._id });
    return res.status(404).json({ message: 'Booking not found or cannot be cancelled.' });
  }

  if (global.io) {
    if (global.io.activeBookings) {
      global.io.activeBookings.delete(String(req.params.id));
    }
    if (booking.driverId && global.io.driverToBooking) {
      global.io.driverToBooking.delete(String(booking.driverId));
    }
    global.io.to(`booking:${req.params.id}`).emit(`booking:${req.params.id}`, { action: 'cancelled' });

    if (booking.driverId) {
      // FIX: Ensure driver is set back to 'active' status so they can receive new rides.
      await Driver.updateOne({ _id: booking.driverId }, { status: 'active' });

      global.io.to(`driver:${String(booking.driverId)}`).emit('booking:cancelled', {
        bookingId: String(booking._id), action: 'cancelled',
      });
      logger.info(`Rider cancelled — notified assigned driver ${booking.driverId}`, { bookingId: booking._id });
    } else {
      global.io.emit('ride:cancelled', {
        bookingId: String(booking._id),
        id:        String(booking._id),
      });
      logger.info(`Rider cancelled during search — broadcast ride:cancelled`, { bookingId: booking._id });
    }
  }

  logger.info(`Booking cancelled: ${booking._id}`, { userId: req.user._id });
  res.json({ message: 'Booking cancelled.' });
}));

module.exports = router;

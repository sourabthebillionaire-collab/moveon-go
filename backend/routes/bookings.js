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
    paid: payment === 'Online', // UPI Intent is assumed successful for simplicity
  });

  logger.info(`Booking created: ${booking._id}`, { userId: req.user._id, type, fareAmount: amount });

  if (global.io) {
    // ✅ PERFORMANCE: Target only drivers of the requested vehicle type
    global.io.to(`drivers:${String(type).toLowerCase()}`).emit('ride:request', {
      id:         booking._id,
      type,       pickup,      dropoff,
      fare,       fareAmount:  amount,
      distance,   duration,
      pickupLat:  pickupCoords.lat,
      pickupLng:  pickupCoords.lng,
      dropoffLat: dropoffCoords.lat,
      dropoffLng: dropoffCoords.lng,
      payment:    booking.payment,
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

// GET /api/bookings/public/:id — Public trip tracking (Unprotected)
router.get('/public/:id', asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('driverId', 'name vehicleNumber rating vehicleType phone')
    .select('pickup dropoff status vehicleType distance duration fareAmount pickupLat pickupLng dropoffLat dropoffLng createdAt');

  if (!booking || !['accepted', 'started'].includes(booking.status)) {
    return res.status(404).json({ message: 'Live trip not found or already ended.' });
  }
  res.json({ booking });
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
    global.io.arrivedNotified?.delete(String(req.params.id));
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

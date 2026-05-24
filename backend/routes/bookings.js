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

// POST /api/bookings/:id/respond — driver accepts or declines
router.post('/:id/respond', protectDriver, asyncHandler(async (req, res) => {
  const { action } = req.body;
  const bookingId  = req.params.id;

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ message: 'Action must be accept or decline.' });
  }

  if (action === 'accept') {
    const booking = await Booking.findOneAndUpdate(
      { _id: bookingId, status: 'searching' },
      { status: 'accepted', driverId: req.driver._id },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: 'Booking not available. Already taken or cancelled.' });
    }

    logger.info(`Booking accepted: ${bookingId}`, { driverId: req.driver._id });

    // Set driver status to 'busy' so they stop receiving new ride requests
    await Driver.updateOne({ _id: req.driver._id }, { status: 'busy' });

    const driverPayload = {
      name:          req.driver.name,
      phone:         req.driver.phone,
      vehicleNumber: req.driver.vehicleNumber,
      vehicleType:   req.driver.vehicleType,
      rating:        req.driver.rating || 4.5,
      eta:           '3–5 min',
      driverId:      String(req.driver._id),
    };

    if (global.io) {
      if (global.io.activeBookings) {
        global.io.activeBookings.set(String(bookingId), String(req.driver._id));
      }
      // BUG FIX #3: rider needs OTP immediately on accept
      const eventPayload = { 
        action: 'accept', 
        driver: driverPayload,
        otp:    booking.startOTP 
      };
      global.io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, eventPayload);
    }

    res.json({ message: 'Booking accepted successfully.', driver: driverPayload });

  } else {
    logger.info(`Booking declined: ${bookingId}`, { driverId: req.driver._id });
    if (global.io) {
      global.io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, { action: 'decline' });
    }
    res.json({ message: 'Booking declined.' });
  }
}));

// PUT /api/bookings/:id/start — driver starts ride after pickup
router.put('/:id/start', protectDriver, asyncHandler(async (req, res) => {
  const { otp } = req.body;

  // FIX: Secure OTP Verification
  const check = await Booking.findById(req.params.id).select('startOTP status driverId');
  if (!check) return res.status(404).json({ message: 'Booking not found.' });

  if (check.startOTP !== String(otp)) {
    logger.warn(`Ride start failed: Invalid OTP for booking ${req.params.id}`, { driverId: req.driver._id });
    return res.status(401).json({ message: 'Invalid OTP. Please ask the passenger for the 4-digit PIN.' });
  }

  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driver._id, status: 'accepted' },
    { status: 'started' },
    { new: true }
  );

  if (!booking) {
    const exists = check;
    if (!exists) {
      return res.status(404).json({ message: 'Booking not found.', code: 'NOT_FOUND' });
    }
    if (String(exists.driverId) !== String(req.driver._id)) {
      return res.status(403).json({ message: 'This ride is not assigned to you.', code: 'WRONG_DRIVER' });
    }
    return res.status(409).json({
      message: `Ride cannot be started. Current status: ${exists.status}`,
      code: 'WRONG_STATUS',
      status: exists.status,
    });
  }

  if (global.io) {
    const driverPayload = {
      name: req.driver.name, phone: req.driver.phone,
      vehicleNumber: req.driver.vehicleNumber, vehicleType: req.driver.vehicleType,
      rating: req.driver.rating || 4.5, eta: '3–5 min',
      driverId: String(req.driver._id),
    };
    const payload = {
      action: 'started', bookingId: String(req.params.id),
      driverId: String(req.driver._id), driver: driverPayload,
    };
    logger.info(`Emitting started for booking ${req.params.id}`, { driverId: req.driver._id });
    global.io.to(`booking:${req.params.id}`).emit(`booking:${req.params.id}`, payload);
  }

  res.json({ message: 'Ride started.' });
}));

// PUT /api/bookings/:id/complete — driver completes the ride
router.put('/:id/complete', protectDriver, asyncHandler(async (req, res) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driver._id, status: 'started' },
    { status: 'completed', completedAt: new Date() },
    { new: true }
  );

  if (!booking) {
    return res.status(404).json({ message: 'Ride cannot be completed. It may not be started yet.' });
  }

  await Driver.updateOne({ _id: req.driver._id }, { $inc: { totalTrips: 1 }, status: 'active' });

  if (global.io) {
    const driverPayload = {
      name: req.driver.name, phone: req.driver.phone,
      vehicleNumber: req.driver.vehicleNumber, vehicleType: req.driver.vehicleType,
      rating: req.driver.rating || 4.5, eta: '3–5 min',
      driverId: String(req.driver._id),
    };
    const payload = {
      action: 'completed', bookingId: String(req.params.id),
      driverId: String(req.driver._id), driver: driverPayload,
      fareAmount: booking.fareAmount,
    };
    logger.info(`Emitting completed for booking ${req.params.id}`, { driverId: req.driver._id });
    global.io.to(`booking:${req.params.id}`).emit(`booking:${req.params.id}`, payload);
    global.io.activeBookings?.delete(String(req.params.id));
    global.io.driverToBooking?.delete(String(req.driver._id));
  }

  res.json({ message: 'Ride completed.', fareAmount: booking.fareAmount });
}));

// PUT /api/bookings/:id/cancel — driver cancels
router.put('/:id/cancel', protectDriver, asyncHandler(async (req, res) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driver._id, status: { $in: ['accepted', 'started'] } },
    { status: 'cancelled' },
    { new: true }
  );

  if (!booking) {
    return res.status(404).json({ message: 'Ride cannot be cancelled. It may not be assigned to you or may already be closed.' });
  }

  // Restore driver status to 'active' so they can receive new ride requests
  await Driver.updateOne({ _id: req.driver._id }, { status: 'active' });

  if (global.io) {
    const payload = { action: 'cancelled', bookingId: String(req.params.id), driverId: String(req.driver._id) };
    logger.info(`Emitting cancelled for booking ${req.params.id}`, { driverId: req.driver._id });
    global.io.to(`booking:${req.params.id}`).emit(`booking:${req.params.id}`, payload);
    global.io.activeBookings?.delete(String(req.params.id));
    global.io.driverToBooking?.delete(String(req.driver._id));
  }

  logger.info(`Driver cancelled booking: ${req.params.id}`, { driverId: req.driver._id });
  res.json({ message: 'Ride cancelled.' });
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

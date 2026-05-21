const router  = require('express').Router();
const { Booking, Driver } = require('../models');
const { protect, protectDriver } = require('../middleware/auth');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');
const { bookingLimiter } = require('../utils/rateLimiter');

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

  const amount = fareAmount || 50;

  const booking = await Booking.create({
    userId:      req.user._id,
    vehicleType: type,
    pickup,      dropoff,
    pickupLat:   pickupCoords?.lat,
    pickupLng:   pickupCoords?.lng,
    dropoffLat:  dropoffCoords?.lat,
    dropoffLng:  dropoffCoords?.lng,
    fare, fareAmount: amount, payment, distance, duration,
    status: 'searching',
  });

  logger.info(`Booking created: ${booking._id}`, { userId: req.user._id, type, fareAmount: amount });

  // Broadcast ride request to all connected drivers
  if (global.io) {
    global.io.emit('ride:request', {
      id:         booking._id,
      type,       pickup,      dropoff,
      fare,       fareAmount:  amount,
      distance,   duration,
      pickupLat:  pickupCoords?.lat,
      pickupLng:  pickupCoords?.lng,
      dropoffLat: dropoffCoords?.lat,
      dropoffLng: dropoffCoords?.lng,
    });
  }

  res.status(201).json({
    message: 'Booking created. Searching for drivers...',
    booking: { id: booking._id, status: booking.status },
  });
}));

// POST /api/bookings/:id/respond — driver accepts or declines
router.post('/:id/respond', protectDriver, asyncHandler(async (req, res) => {
  const { action } = req.body; // 'accept' or 'decline'
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

      const eventPayload = { action: 'accept', driver: driverPayload };

      // Emit to booking room (targeted) + fallback broadcast
      global.io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, eventPayload);
      global.io.emit(`booking:${bookingId}`, eventPayload);
    }

    res.json({
      message: 'Booking accepted successfully.',
      driver: driverPayload,
    });

  } else {
    logger.info(`Booking declined: ${bookingId}`, { driverId: req.driver._id });

    if (global.io) {
      global.io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, { action: 'decline' });
    }

    res.json({ message: 'Booking declined.' });
  }
}));

// PUT /api/bookings/:id/start — driver starts the ride after pickup
router.put('/:id/start', protectDriver, asyncHandler(async (req, res) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driver._id, status: 'accepted' },
    { status: 'started' },
    { new: true }
  );

  if (!booking) {
    return res.status(404).json({ message: 'Ride cannot be started. It may have been cancelled or already started.' });
  }

  if (global.io) {
    const driverPayload = {
      name:          req.driver.name,
      phone:         req.driver.phone,
      vehicleNumber: req.driver.vehicleNumber,
      vehicleType:   req.driver.vehicleType,
      rating:        req.driver.rating || 4.5,
      eta:           '3–5 min',
      driverId:      String(req.driver._id),
    };
    const payload = {
      action:    'started',
      bookingId: String(req.params.id),
      driverId:  String(req.driver._id),
      driver:    driverPayload,
    };
    logger.info(`Emitting started for booking ${req.params.id}`, { driverId: req.driver._id });
    global.io.to(`booking:${req.params.id}`).emit(`booking:${req.params.id}`, payload);
    global.io.emit(`booking:${req.params.id}`, payload);
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

  await Driver.updateOne({ _id: req.driver._id }, { $inc: { totalTrips: 1 } });

  if (global.io) {
    const driverPayload = {
      name:          req.driver.name,
      phone:         req.driver.phone,
      vehicleNumber: req.driver.vehicleNumber,
      vehicleType:   req.driver.vehicleType,
      rating:        req.driver.rating || 4.5,
      eta:           '3–5 min',
      driverId:      String(req.driver._id),
    };
    const payload = {
      action:     'completed',
      bookingId:  String(req.params.id),
      driverId:   String(req.driver._id),
      driver:     driverPayload,
      fareAmount: booking.fareAmount,
    };
    logger.info(`Emitting completed for booking ${req.params.id}`, { driverId: req.driver._id, fareAmount: booking.fareAmount });
    global.io.to(`booking:${req.params.id}`).emit(`booking:${req.params.id}`, payload);
    global.io.emit(`booking:${req.params.id}`, payload);
    global.io.activeBookings?.delete(String(req.params.id));
  }

  res.json({ message: 'Ride completed.', fareAmount: booking.fareAmount });
}));

// PUT /api/bookings/:id/cancel — driver cancels an accepted or started ride
router.put('/:id/cancel', protectDriver, asyncHandler(async (req, res) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, driverId: req.driver._id, status: { $in: ['accepted', 'started'] } },
    { status: 'cancelled' },
    { new: true }
  );

  if (!booking) {
    return res.status(404).json({ message: 'Ride cannot be cancelled. It may not be assigned to you or may already be closed.' });
  }

  if (global.io) {
    const payload = {
      action:    'cancelled',
      bookingId: String(req.params.id),
      driverId:  String(req.driver._id),
    };
    logger.info(`Emitting cancelled for booking ${req.params.id}`, { driverId: req.driver._id });
    global.io.to(`booking:${req.params.id}`).emit(`booking:${req.params.id}`, payload);
    global.io.emit(`booking:${req.params.id}`, payload);
    global.io.activeBookings?.delete(String(req.params.id));
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

// GET /api/bookings/active — get rider's active booking
router.get('/active', protect, asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({
    userId: req.user._id,
    status: { $in: ['searching', 'accepted', 'started'] },
  }).populate('driverId', 'name phone vehicleNumber rating vehicleType');

  logger.info(`Active booking query`, { userId: req.user._id, found: !!booking });
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

    // Notify the rider's own booking room
    global.io.to(`booking:${req.params.id}`).emit(`booking:${req.params.id}`, { action: 'cancelled' });
    global.io.emit(`booking:${req.params.id}`, { action: 'cancelled' });

    // ── BUG FIX #4 ─────────────────────────────────────────────
    // Previously: when booking.status was 'searching', booking.driverId
    // is null, so the driver:${driverId} emit was skipped entirely.
    // The driver would never know the rider cancelled during the search
    // phase and would keep seeing the ride request card indefinitely.
    //
    // Fix: always broadcast 'ride:cancelled' to ALL drivers when the
    // booking is in 'searching' state (no specific driver assigned yet).
    // When a specific driver is assigned, we still target their room.
    if (booking.driverId) {
      // Accepted ride — notify the specific assigned driver
      global.io.to(`driver:${String(booking.driverId)}`).emit('booking:cancelled', {
        bookingId: String(booking._id),
        action:    'cancelled',
      });
      logger.info(`Rider cancelled — notified assigned driver ${booking.driverId}`, { bookingId: booking._id });
    } else {
      // Searching state — broadcast to all drivers so any driver who
      // received this ride:request knows it's been withdrawn
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
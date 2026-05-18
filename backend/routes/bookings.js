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

      // Emit to booking room (riders who joined via rider:joinBooking)
      global.io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, eventPayload);

      // ✅ ALSO broadcast to ALL as fallback — rider's socket.on('booking:'+id)
      // filters by event name so other sockets silently ignore it.
      // Guarantees delivery even if rider:joinBooking emit was lost or delayed.
      global.io.emit(`booking:${bookingId}`, eventPayload);
    }

    res.json({
      message: 'Booking accepted successfully.',
      driver: driverPayload,
    });

  } else {
    logger.info(`Booking declined: ${bookingId}`, { driverId: req.driver._id });

    if (global.io) {
      // ✅ FIX: Decline also goes to the room, not broadcast
      global.io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, { action: 'decline' });
    }

    res.json({ message: 'Booking declined.' });
  }
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

// DELETE /api/bookings/:id — cancel booking
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
    // ✅ FIX: Cancellation also room-targeted
    global.io.to(`booking:${req.params.id}`).emit(`booking:${req.params.id}`, { action: 'cancelled' });
  }

  logger.info(`Booking cancelled: ${booking._id}`, { userId: req.user._id });
  res.json({ message: 'Booking cancelled.' });
}));

module.exports = router;
const router  = require('express').Router();
const { Booking } = require('../models');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');
const { bookingLimiter } = require('../utils/rateLimiter');

// POST /api/bookings
router.post('/', protect, bookingLimiter, asyncHandler(async (req, res) => {
  const { type, pickup, pickupCoords, dropoff, dropoffCoords, fare, fareAmount, payment, distance, duration } = req.body;

  if (!type || !pickup || !dropoff || !pickupCoords || !dropoffCoords || !fareAmount || !payment) {
    logger.warn('Booking creation: missing required fields', { userId: req.user._id });
    return res.status(400).json({ message: 'Missing required booking fields.' });
  }

  const booking = await Booking.create({
    userId:      req.user._id,
    vehicleType: type,
    pickup,      dropoff,
    pickupLat:   pickupCoords?.lat,
    pickupLng:   pickupCoords?.lng,
    dropoffLat:  dropoffCoords?.lat,
    dropoffLng:  dropoffCoords?.lng,
    fare, fareAmount, payment, distance, duration,
    status: 'searching',
  });

  logger.info(`Booking created: ${booking._id}`, { userId: req.user._id, type, fareAmount });

  if (global.io) {
    global.io.emit('ride:request', {
      id: booking._id,
      type, pickup, dropoff, fare, fareAmount, distance, duration,
      pickupLat:  pickupCoords?.lat, pickupLng:  pickupCoords?.lng,
      dropoffLat: dropoffCoords?.lat, dropoffLng: dropoffCoords?.lng,
    });
  }

  res.status(201).json({ message: 'Booking created.', booking: { id: booking._id, status: booking.status } });
}));

// GET /api/bookings
router.get('/', protect, asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20);
  logger.info(`Bookings fetched: ${bookings.length} found`, { userId: req.user._id });
  res.json({ bookings });
}));

// GET /api/bookings/active
router.get('/active', protect, asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({
    userId: req.user._id,
    status: { $in: ['searching', 'accepted', 'started'] },
  }).populate('driverId', 'name phone vehicleNumber rating');
  
  logger.info(`Active booking query`, { userId: req.user._id, found: !!booking });
  res.json({ booking: booking || null });
}));

// DELETE /api/bookings/:id
router.delete('/:id', protect, asyncHandler(async (req, res) => {
  const booking = await Booking.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id, status: { $in: ['searching', 'accepted'] } },
    { status: 'cancelled' },
    { new: true }
  );
  
  if (!booking) {
    logger.warn(`Booking cancel attempt: not found or invalid status`, { bookingId: req.params.id, userId: req.user._id });
    return res.status(404).json({ message: 'Booking not found or cannot be cancelled.' });
  }
  
  logger.info(`Booking cancelled: ${booking._id}`, { userId: req.user._id });
  res.json({ message: 'Booking cancelled.' });
}));

module.exports = router;

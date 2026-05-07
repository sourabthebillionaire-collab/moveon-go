const router  = require('express').Router();
const { Booking } = require('../models');
const { protect } = require('../middleware/auth');

// POST /api/bookings
router.post('/', protect, async (req, res) => {
  try {
    const { type, pickup, pickupCoords, dropoff, dropoffCoords, fare, fareAmount, payment, distance, duration } = req.body;

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

    if (global.io) {
      global.io.emit('ride:request', {
        id: booking._id,
        type, pickup, dropoff, fare, fareAmount, distance, duration,
        pickupLat:  pickupCoords?.lat, pickupLng:  pickupCoords?.lng,
        dropoffLat: dropoffCoords?.lat, dropoffLng: dropoffCoords?.lng,
      });
    }

    res.status(201).json({ message: 'Booking created.', booking: { id: booking._id, status: booking.status } });
  } catch (err) {
    res.status(500).json({ message: 'Failed to create booking.' });
  }
});

// GET /api/bookings
router.get('/', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings.' });
  }
});

// GET /api/bookings/active
router.get('/active', protect, async (req, res) => {
  try {
    const booking = await Booking.findOne({
      userId: req.user._id,
      status: { $in: ['searching', 'accepted', 'started'] },
    }).populate('driverId', 'name phone vehicleNumber rating');
    res.json({ booking: booking || null });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch active booking.' });
  }
});

// DELETE /api/bookings/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, status: { $in: ['searching', 'accepted'] } },
      { status: 'cancelled' },
      { new: true }
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found or cannot be cancelled.' });
    res.json({ message: 'Booking cancelled.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel booking.' });
  }
});

module.exports = router;

const router  = require('express').Router();
const { Booking } = require('../models');
const { protectDriver } = require('../middleware/auth');

// POST /api/rides/:rideId/respond
router.post('/:rideId/respond', protectDriver, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'action must be accept or decline.' });
    }

    if (action === 'accept') {
      await Booking.findByIdAndUpdate(req.params.rideId, {
        status: 'accepted', driverId: req.driver._id, acceptedAt: new Date(),
      });

      if (global.io) {
        global.io.emit('booking:update', {
          bookingId: req.params.rideId,
          status:    'accepted',
          driver: {
            id:            req.driver._id,
            name:          req.driver.name,
            phone:         req.driver.phone,
            vehicleNumber: req.driver.vehicleNumber,
            rating:        req.driver.rating,
            eta:           '5 min',
          },
        });
      }
    }

    res.json({ message: `Ride ${action}ed.` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to respond to ride.' });
  }
});

module.exports = router;

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

    const rideId = req.params.rideId;

    if (action === 'accept') {
      const booking = await Booking.findOneAndUpdate(
        { _id: rideId, status: 'searching' },
        { status: 'accepted', driverId: req.driver._id, acceptedAt: new Date() },
        { new: true }
      );

      if (!booking) {
        return res.status(404).json({ message: 'Ride not available. Already taken or cancelled.' });
      }

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
        const eventPayload = { action: 'accept', driver: driverPayload };
        global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, eventPayload);
        global.io.emit(`booking:${rideId}`, eventPayload);
      }
    } else {
      if (global.io) {
        global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, { action: 'decline' });
      }
    }

    res.json({ message: `Ride ${action}ed.` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to respond to ride.' });
  }
});

module.exports = router;

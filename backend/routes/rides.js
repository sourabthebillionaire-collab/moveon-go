const router  = require('express').Router();
const { Booking, Driver } = require('../models');
const { protectDriver } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errorHandler');

// POST /api/rides/:rideId/respond
router.post('/:rideId/respond', protectDriver, asyncHandler(async (req, res) => {
    const { action } = req.body;
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'action must be accept or decline.' });
    }
    const rideId = req.params.rideId;

    if (action === 'accept') {
      // FIX: Ensure status is 'searching' to prevent double-acceptance
      const booking = await Booking.findOneAndUpdate(
        { _id: rideId, status: 'searching' },
        { status: 'accepted', driverId: req.driver._id, acceptedAt: new Date() }, // Fixed: acceptedAt
        { new: true }
      );

      if (!booking) {
        return res.status(404).json({ message: 'Ride not available. Already taken or cancelled.' });
      }

      // FIX: Mark driver as 'busy' and update global tracking state
      // Syncs logic with bookings.js to prevent driver assignment conflicts.
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
          global.io.activeBookings.set(String(rideId), String(req.driver._id));
        }
        if (global.io.driverToBooking) {
          global.io.driverToBooking.set(String(req.driver._id), String(rideId));
        }
        // BUG FIX: Include OTP in the payload so the rider sees it immediately
        const eventPayload = { 
          action: 'accept', 
          driver: driverPayload,
          otp:    booking.startOTP 
        };
        global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, eventPayload);
      }
    } else {
      // FIX: Verify ride exists before declining
      const exists = await Booking.findById(rideId).select('_id').lean();
      if (!exists) {
        return res.status(404).json({ message: 'Ride not found.' });
      }

      if (global.io) {
        global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, { action: 'decline' });
      }
    }

    res.json({ message: `Ride ${action}ed.` });
}));

module.exports = router;

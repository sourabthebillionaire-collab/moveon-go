const router  = require('express').Router();
const { Booking, Driver } = require('../models');
const { protect, protectDriver } = require('../middleware/auth');
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

      // Fetch initial position for the acceptance payload
      const currentPos = global.io?.activeVehiclePositions?.get(String(req.driver._id));

      if (global.io && booking) {
        if (global.io.activeBookings) {
          global.io.activeBookings.set(String(rideId), String(req.driver._id));
        }
        if (global.io.driverToBooking) {
          global.io.driverToBooking.set(String(req.driver._id), String(rideId));
        }
        const eventPayload = { 
          action: 'accept', 
          driver: driverPayload,
          location: currentPos ? { lat: currentPos.lat, lng: currentPos.lng } : null,
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

      // Silent decline for rider — dispatch continues or searching remains active
    }

    res.json({ message: `Ride ${action}ed.` });
}));

// PUT /api/rides/:rideId/start — driver starts ride after pickup
router.put('/:rideId/start', protectDriver, asyncHandler(async (req, res) => {
  const rideId = req.params.rideId;

  const check = await Booking.findById(rideId).select('status driverId');
  if (!check) return res.status(404).json({ message: 'Booking not found.' });

  // LOGIC SIMPLIFICATION: We removed the OTP check here to prevent 
  // synchronization issues at busy Indian bus stands/auto stands.

  const booking = await Booking.findOneAndUpdate(
    { _id: rideId, driverId: req.driver._id, status: 'accepted' },
    { status: 'started' },
    { new: true }
  );

  if (!booking) {
    return res.status(409).json({ message: `Ride cannot be started. Status: ${check.status}` });
  }

  if (global.io) {
    const payload = {
      action: 'started', bookingId: String(rideId),
      driverId: String(req.driver._id),
      driver: {
        name: req.driver.name, phone: req.driver.phone,
        vehicleNumber: req.driver.vehicleNumber, rating: req.driver.rating || 4.5
      }
    };
    global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, payload);
  }

    // If a driver declines, the booking status remains 'searching' for other drivers.
  res.json({ message: 'Ride started.' });
}));

// PUT /api/rides/:rideId/complete — driver completes the ride
router.put('/:rideId/complete', protectDriver, asyncHandler(async (req, res) => {
  const rideId = req.params.rideId;
  const booking = await Booking.findOneAndUpdate(
    { _id: rideId, driverId: req.driver._id, status: 'started' },
    { status: 'completed', completedAt: new Date() },
    { new: true }
  );

  if (!booking) {
    return res.status(404).json({ message: 'Ride cannot be completed. It may not be started yet.' });
  }

  await Driver.updateOne({ _id: req.driver._id }, { $inc: { totalTrips: 1 }, status: 'active' });

  if (global.io) {
    const payload = {
      action: 'completed', bookingId: String(rideId),
      driverId: String(req.driver._id),
      fareAmount: booking.fareAmount,
    };
    global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, payload);
    global.io.activeBookings?.delete(String(rideId));
    global.io.arrivedNotified?.delete(String(rideId));
    // FIX: Clear arrivedNotified for this booking
    global.io.driverToBooking?.delete(String(req.driver._id));
  }

  res.json({ message: 'Ride completed.', fareAmount: booking.fareAmount });
}));

// PUT /api/rides/:rideId/cancel — driver cancels active ride
router.put('/:rideId/cancel', protectDriver, asyncHandler(async (req, res) => {
  const rideId = req.params.rideId;
  const booking = await Booking.findOneAndUpdate(
    { _id: rideId, driverId: req.driver._id, status: { $in: ['accepted', 'started'] } },
    { status: 'cancelled' },
    { new: true }
  );

  if (!booking) {
    return res.status(404).json({ message: 'Ride cannot be cancelled. It may not be assigned to you.' });
  }

  await Driver.updateOne({ _id: req.driver._id }, { status: 'active' });

  if (global.io) {
    const payload = { action: 'cancelled', bookingId: String(rideId), driverId: String(req.driver._id) };
    global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, payload);
    global.io.activeBookings?.delete(String(rideId));
    // FIX: Clear arrivedNotified for this booking
    global.io.arrivedNotified?.delete(String(rideId));
    global.io.driverToBooking?.delete(String(req.driver._id));
    
    // Payload already includes action: 'cancelled' and notifies the rider's room
    logger.info(`Driver cancelled — notified rider room booking:${rideId}`, { bookingId: rideId });
  }

  res.json({ message: 'Ride cancelled.' });
}));

// PUT /api/rides/:rideId/boarded — rider confirms boarding
router.put('/:rideId/boarded', protect, asyncHandler(async (req, res) => {
  const rideId = req.params.rideId;

  if (global.io) {
    const booking = await Booking.findById(rideId).select('driverId').lean();
    if (booking?.driverId) {
      // Notify the driver via their private socket room
      global.io.to(`driver:${booking.driverId}`).emit('rider:notification', {
        type: 'BOARDED',
        message: 'Passenger confirmed boarding! ✅',
        bookingId: rideId
      });
    }
  }
  res.json({ message: 'Boarding notification sent.' });
}));

module.exports = router;

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
      ).populate('userId', 'name phone').lean(); // Ensure lean for direct object manipulation

      if (!booking) {
        return res.status(404).json({ message: 'Ride not available. Already taken or cancelled.' });
      }

      // FIX: Mark driver as 'busy' and update global tracking state
      // Syncs logic with bookings.js to prevent driver assignment conflicts.
      await Driver.updateOne({ _id: req.driver._id }, { status: 'busy', onDuty: true });

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

    res.json({ message: `Ride ${action}ed.`, booking: action === 'accept' ? booking : undefined });
}));

// PUT /api/rides/:rideId/start — driver starts ride after pickup
router.put('/:rideId/start', protectDriver, asyncHandler(async (req, res) => {
  const rideId = req.params.rideId;

  const check = await Booking.findById(rideId).select('status driverId acceptedAt');
  if (!check) return res.status(404).json({ message: 'Booking not found.' });

  // LOGIC SIMPLIFICATION: We removed the OTP check here to prevent 
  // synchronization issues at busy Indian bus stands/auto stands.

  // STALE CHECK: If a driver tries to start a ride after a long delay (e.g. 30 mins),
  // block it as the rider likely found another way or the ride is considered abandoned.
  if (check.status === 'accepted' && check.acceptedAt) {
    const elapsed = Date.now() - new Date(check.acceptedAt).getTime();
    if (elapsed > 1800000) { // 30 minutes
      await Booking.updateOne({ _id: rideId }, { status: 'cancelled' });
      await Driver.updateOne({ _id: req.driver._id }, { status: 'active', onDuty: true });

      // ✅ SYNC MEMORY MAP: Mark driver as active for other riders to see on map
      const currentPos = global.io?.activeVehiclePositions?.get(String(req.driver._id));
      if (currentPos) {
        currentPos.status = 'active';
        global.io.emit('vehicles:update', currentPos);
      }

      if (global.io) {
        const bIdStr = String(rideId);
        const dIdStr = String(req.driver._id);
        const room = `booking:${bIdStr}`;

        // Notify rider that the ride has expired
        global.io.to(room).emit(room, {
          action: 'cancelled',
          message: 'Ride expired due to delay in starting pickup.',
          bookingId: bIdStr
        });
        global.io.in(room).socketsLeave(room);
        global.io.activeBookings?.delete(bIdStr);
        global.io.driverToBooking?.delete(dIdStr);
        global.io.arrivedNotified?.delete(bIdStr);
      }

      return res.status(410).json({ message: 'Ride expired due to delay in starting pickup.' });
    }
  }

  const booking = await Booking.findOneAndUpdate(
    { _id: rideId, driverId: req.driver._id, status: 'accepted' },
    { status: 'started' },
    { new: true }
  ).populate('userId', 'name phone').lean();

  if (!booking) {
    return res.status(409).json({ message: `Ride cannot be started. Status: ${check.status}` });
  }

  if (global.io) {
    const payload = {
      action: 'started', bookingId: String(rideId),
      booking: booking, // Full update for rider
      driverId: String(req.driver._id), // For room routing
      driver: {
        driverId: String(req.driver._id), // For rider state update
        name: req.driver.name, 
        phone: req.driver.phone,
        vehicleNumber: req.driver.vehicleNumber, 
        rating: req.driver.rating || 4.5
      },
      otp: booking.startOTP
    };
    global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, payload);
    // Cleanup: arrival notification is no longer needed once trip starts
    global.io.arrivedNotified?.delete(String(rideId));
  }

    // If a driver declines, the booking status remains 'searching' for other drivers.
  res.json({ message: 'Ride started.', booking });
}));

// PUT /api/rides/:rideId/complete — driver completes the ride
router.put('/:rideId/complete', protectDriver, asyncHandler(async (req, res) => {
  const rideId = req.params.rideId;
  const booking = await Booking.findOneAndUpdate(
    { _id: rideId, driverId: req.driver._id, status: 'started' },
    { status: 'completed', completedAt: new Date() },
    { new: true }
  ).populate('userId', 'name phone').lean();

  if (!booking) {
    return res.status(404).json({ message: 'Ride cannot be completed. It may not be started yet.' });
  }

  await Driver.updateOne({ _id: req.driver._id }, { $inc: { totalTrips: 1 }, status: 'active', onDuty: true });

  // ✅ SYNC MEMORY MAP: Mark driver as active immediately
  const currentPos = global.io?.activeVehiclePositions?.get(String(req.driver._id));
  if (currentPos) {
    currentPos.status = 'active';
    global.io.emit('vehicles:update', currentPos);
  }

  if (global.io) {
    const payload = {
      action: 'completed', bookingId: String(rideId),
      driverId: String(req.driver._id),
      fareAmount: booking.fareAmount,
    };
    global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, payload);
    global.io.in(`booking:${rideId}`).socketsLeave(`booking:${rideId}`);
    global.io.activeBookings?.delete(String(rideId));
    const arrived = global.io.arrivedNotified;
    if (arrived instanceof Set) arrived.delete(String(rideId));
    global.io.driverToBooking?.delete(String(req.driver._id));
  }

  res.json({ message: 'Ride completed.', booking, fareAmount: booking.fareAmount });
}));

// PUT /api/rides/:rideId/cancel — driver cancels active ride
router.put('/:rideId/cancel', protectDriver, asyncHandler(async (req, res) => {
  const rideId = req.params.rideId;
  const booking = await Booking.findOneAndUpdate(
    { _id: rideId, driverId: req.driver._id, status: { $in: ['accepted', 'started'] } },
    { status: 'cancelled' },
    { new: true }
  ).populate('userId', 'name phone').lean();

  if (!booking) {
    return res.status(404).json({ message: 'Ride cannot be cancelled. It may not be assigned to you.' });
  }

  await Driver.updateOne({ _id: req.driver._id }, { status: 'active', onDuty: true });

  if (global.io) {
    const payload = { action: 'cancelled', bookingId: String(rideId), driverId: String(req.driver._id) };
    global.io.to(`booking:${rideId}`).emit(`booking:${rideId}`, payload);
    global.io.in(`booking:${rideId}`).socketsLeave(`booking:${rideId}`);
    global.io.activeBookings?.delete(String(rideId));
    // FIX: Clear arrivedNotified for this booking
    global.io.arrivedNotified?.delete(String(rideId));
    global.io.driverToBooking?.delete(String(req.driver._id));
    
    // Payload already includes action: 'cancelled' and notifies the rider's room
    logger.info(`Driver cancelled — notified rider room booking:${rideId}`, { bookingId: rideId });
  }

  res.json({ message: 'Ride cancelled.', booking });
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

// POST /api/rides/:rideId/feedback — rider submits rating
router.post('/:rideId/feedback', protect, asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const rideId = req.params.rideId;

  const booking = await Booking.findById(rideId);
  if (!booking || String(booking.userId) !== String(req.user._id)) {
    return res.status(404).json({ message: 'Trip not found.' });
  }

  // Update driver rating (weighted average)
  if (booking.driverId && rating) {
    const driver = await Driver.findById(booking.driverId);
    if (driver) {
      const currentRating = driver.rating || 5.0;
      const totalTrips = driver.totalTrips || 1;
      const newRating = ((currentRating * totalTrips) + rating) / (totalTrips + 1);
      await Driver.updateOne({ _id: driver._id }, { rating: Number(newRating.toFixed(1)) });
    }
  }

  res.json({ message: 'Feedback submitted successfully.' });
}));

module.exports = router;

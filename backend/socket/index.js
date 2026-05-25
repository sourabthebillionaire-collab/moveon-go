const { Driver, Booking } = require('../models');

// Helper for distance calculation (km)
function getDist(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

module.exports = function initSocket(io) {
  // ✅ SHARED MAPS: Use existing maps from io object to ensure REST routes and Sockets sync perfectly
  const connectedDrivers       = new Map(); 
  const activeVehiclePositions = io.activeVehiclePositions || new Map();
  const activeBookings         = io.activeBookings         || new Map();
  const driverToBooking        = io.driverToBooking        || new Map();

  io.activeVehiclePositions = activeVehiclePositions;
  io.driverToBooking        = driverToBooking;
  io.activeBookings         = activeBookings;

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── Rider: send snapshot + join their booking room ──────────
    socket.on('rider:connected', () => {
      const snapshot = Array.from(activeVehiclePositions.values());
      socket.emit('vehicles:snapshot', snapshot);
    });

    // Rider joins a dedicated room for their booking.
    // Called immediately after POST /api/bookings returns a bookingId.
    // If the driver already accepted (race condition), replay the accept event.
    socket.on('rider:joinBooking', async ({ bookingId }) => {
      const bId = bookingId ? String(bookingId) : null;
      if (!bId) return;
      socket.join(`booking:${bId}`);
      console.log(`[Socket] Rider joined room booking:${bId}`);

      // SELF-HEALING: If mapping is lost (e.g. server restart), reconstruct from DB
      let driverId = activeBookings.get(bId);
      if (!driverId) {
        const booking = await Booking.findById(bId).select('driverId status').lean();
        if (booking && booking.driverId && ['accepted', 'started'].includes(booking.status)) {
          driverId = String(booking.driverId);
          activeBookings.set(bId, driverId);
          driverToBooking.set(driverId, bId);
        }
      }

      if (driverId) {
        const dId = String(driverId);
        driverToBooking.set(dId, bId);
        const [driver, booking] = await Promise.all([
          Driver.findById(dId).select('name phone vehicleNumber vehicleType rating').lean(),
          Booking.findById(bId).select('startOTP status').lean()
        ]);

        const pos = activeVehiclePositions.get(dId);
        // Replay 'accept' or 'started' based on actual DB state
        const action = booking?.status === 'started' ? 'started' : 'accept';

        socket.emit(`booking:${bId}`, {
          action,
          otp:    booking?.startOTP,
          driver: driver ? {
            name:          driver.name,
            phone:         driver.phone,
            vehicleNumber: driver.vehicleNumber,
            vehicleType:   driver.vehicleType,
            rating:        driver.rating || 4.5,
            driverId:      String(driver._id),
            eta:           '3–5 min',
            location:      pos ? { lat: pos.lat, lng: pos.lng } : null,
          } : null,
          location: pos ? { lat: pos.lat, lng: pos.lng } : null,
        });
      }
    });

    // ── Driver: register into their personal room ──────────────
    socket.on('driver:register', async ({ driverId, vehicleType }) => {
      if (!driverId) return;
      const dId = String(driverId);
      connectedDrivers.set(socket.id, dId);
      socket.join(`driver:${dId}`);
      
      // SELF-HEALING: Restore active booking mapping for location tracking
      const booking = await Booking.findOne({ 
        driverId: dId, 
        status: { $in: ['accepted', 'started'] } 
      }).select('_id').lean();
      
      if (booking) {
        const bId = String(booking._id);
        driverToBooking.set(dId, bId);
        activeBookings.set(bId, dId);
      }

      // ✅ PERFORMANCE: Join a room for their vehicle type for targeted dispatching
      if (vehicleType) socket.join(`drivers:${vehicleType}`);
      console.log(`[Socket] Driver registered: ${driverId}`);
    });

    // ── Driver: location broadcast ─────────────────────────────
    socket.on('driver:location', async (data) => {
      const {
        driverId, lat, lng, bearing, speed, status,
        type, vehicleNumber, busName, routeFrom, routeTo, routeNumber, passengers, capacity
      } = data;
      
      const isNum = (v) => typeof v === 'number' && !isNaN(v);
      if (!isNum(lat) || !isNum(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;

      const posPayload = {
        id: driverId, lat, lng, bearing, speed, status,
        type, vehicleNumber,
        busName:     busName     || '',
        routeFrom:   routeFrom   || '',
        routeTo:     routeTo     || '',
        routeNumber: routeNumber || '',
        passengers:  passengers  || 0,
        capacity:    capacity    || 60,
        ts: Date.now(),
      };

      activeVehiclePositions.set(String(driverId), posPayload);

      try {
        await Driver.updateOne({ _id: driverId }, {
          'location.lat':       lat,
          'location.lng':       lng,
          'location.bearing':   bearing || 0,
          'location.speed':     speed   || 0,
          'location.updatedAt': new Date(),
          status:               status  || 'active',
          onDuty:               status !== 'offline',
        });
      } catch {}

      // Broadcast to all riders (map view)
      io.emit('vehicles:update', posPayload);

      // Optimized Matching: Direct lookup instead of O(N) loop
      const activeBookingId = driverToBooking.get(String(driverId));
      if (activeBookingId) {
        // 1. Send precise location to matched rider
        io.to(`booking:${activeBookingId}`).emit('driver:locationUpdate', {
          driverId, lat, lng, bearing, speed,
        });

        // 2. Automated "Arrived" notification logic
        const bookingData = await Booking.findById(activeBookingId).select('pickupLat pickupLng status');
        if (bookingData && bookingData.status === 'accepted') {
          const dist = getDist(lat, lng, bookingData.pickupLat, bookingData.pickupLng);
          // Prevent spamming the rider with notification on every move
          if (dist < 0.2 && !io.arrivedNotified?.has(activeBookingId)) {
            if (!io.arrivedNotified) io.arrivedNotified = new Set();
            io.arrivedNotified.add(activeBookingId);
            
            io.to(`booking:${activeBookingId}`).emit(`booking:${activeBookingId}`, { 
              action: 'driver_arrived',
              message: 'Your driver has arrived at the pickup location!' 
            });
            console.log(`[Socket] Arrived notification sent for booking ${activeBookingId}`);
          }
        }
      }

      if (status === 'SOS') {
        console.warn(`[SOS] Driver ${driverId} at ${lat},${lng}`);
        io.emit('driver:sos', { driverId, lat, lng, ts: Date.now() });
      }
    });

    // ── Rider: live location updates for accepted booking ──────
    socket.on('rider:location', (data) => {
      const { bookingId, lat, lng, bearing, speed } = data || {};
      if (!bookingId || lat == null || lng == null) return;
      const driverId = activeBookings.get(String(bookingId));
      if (!driverId) return;
      io.to(`driver:${driverId}`).emit('rider:locationUpdate', {
        bookingId, lat, lng, bearing, speed,
      });
    });

    // Fallback path for ride respond (HTTP is the primary path).
    // Covers the edge case where the HTTP call fails but socket is alive.
    socket.on('ride:respond', ({ rideId, action, driver }) => {
      const rId = String(rideId);
      if (!rId || !action) return;
      
      if (action === 'accept') {
        const driverId = connectedDrivers.get(socket.id);
        if (driverId) {
          activeBookings.set(rId, String(driverId));
          driverToBooking.set(String(driverId), rId);
        }
      }
      io.to(`booking:${rId}`).emit(`booking:${rId}`, {
        action,
        driver: driver || null,
      });
    });

    // ── BUG FIX #1 ─────────────────────────────────────────────
    // trip:ended was previously only cleaning up activeBookings but
    // NOT notifying the rider. Now it emits a 'completed' event to
    // the booking room so the rider sees "Trip Completed" screen.
    // Note: the HTTP PUT /complete route also emits this — trip:ended
    // is a safety net for edge cases (driver app crash recovery, etc).
    socket.on('trip:ended', ({ bookingId }) => {
      if (!bookingId) return;
      const roomName = `booking:${bookingId}`;
      const driverId = activeBookings.get(String(bookingId));
      // Notify the rider's booking room
      io.to(roomName).emit(roomName, {
        action:    'completed',
        bookingId: String(bookingId),
        driverId:  driverId ? String(driverId) : null,
      });
      // FIX: Evacuate the room after trip completion
      io.in(roomName).socketsLeave(roomName);
      activeBookings.delete(String(bookingId));
      io.arrivedNotified?.delete(String(bookingId));
      if (driverId) driverToBooking.delete(String(driverId));
      console.log(`[Socket] trip:ended for booking ${bookingId} — rider notified`);
    });

    // ── Disconnect ─────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const driverId = connectedDrivers.get(socket.id);
      if (driverId) {
        connectedDrivers.delete(socket.id);
        activeVehiclePositions.delete(String(driverId));

        // ── BUG FIX #2 ───────────────────────────────────────────
        // Previously: disconnect only deleted from activeBookings +
        // emitted driver:offline globally. The rider had NO listener
        // for driver:offline, so they were stuck on "Driver Found"
        // forever if the driver disconnected mid-ride.
        //
        // Now: we find the affected booking, emit a 'driver_offline'
        // action directly to that booking room, THEN broadcast
        // driver:offline for map cleanup.
        for (const [bookingId, bDriverId] of activeBookings.entries()) {
          if (String(bDriverId) === String(driverId)) {
            // Notify the specific rider — driver went offline
            const bIdStr = String(bookingId);
            io.to(`booking:${bIdStr}`).emit(`booking:${bIdStr}`, {
              action:    'driver_offline',
              bookingId: bIdStr,
              driverId:  String(driverId),
            });
            activeBookings.delete(bookingId);
            driverToBooking.delete(String(driverId));
            console.log(`[Socket] Driver ${driverId} disconnected mid-ride — rider for booking ${bookingId} notified`);
            break;
          }
        }

        try {
          await Driver.updateOne({ _id: driverId }, { status: 'offline', onDuty: false });
          io.emit('driver:offline', { driverId });
        } catch {}
      }
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });

  global.io = io;

  // Mark stale drivers offline every 2 min
  setInterval(async () => {
    try {
      const stale = await Driver.find({
        onDuty: true,
        'location.updatedAt': { $lt: new Date(Date.now() - 45000) }, // Tighter cleanup
      }).select('_id'); // Optimization: only fetch IDs
      for (const d of stale) {
        await Driver.updateOne({ _id: d._id }, { status: 'offline', onDuty: false });
        activeVehiclePositions.delete(String(d._id));
        
        // ── BUG FIX #3 ───────────────────────────────────────────
        // Stale-driver cleanup also needs to notify any active rider.
        // Previously this only did io.emit('driver:offline') which
        // riders had no handler for in their booking context.
        for (const [bookingId, bDriverId] of activeBookings.entries()) {
          if (String(bDriverId) === String(d._id)) {
            io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, {
              action:    'driver_offline',
              bookingId: String(bookingId),
              driverId:  String(d._id),
            });
            activeBookings.delete(bookingId);
            driverToBooking.delete(String(d._id));
            console.log(`[Socket] Stale driver ${d._id} — rider for booking ${bookingId} notified`);
            break;
          }
        }

        io.emit('driver:offline', { driverId: d._id });
      }
    } catch {}
  }, 60000); // FIX: Run every 60 seconds for tighter tracking
};
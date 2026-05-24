const { Driver } = require('../models');

module.exports = function initSocket(io) {
  const connectedDrivers       = new Map(); // socketId  → driverId
  const activeVehiclePositions = new Map(); // driverId  → latest position
  const activeBookings         = new Map(); // bookingId → driverId
  io.activeBookings = activeBookings;

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
      if (!bookingId) return;
      socket.join(`booking:${bookingId}`);
      console.log(`[Socket] Rider joined room booking:${bookingId}`);

      const driverId = activeBookings.get(String(bookingId));
      if (driverId) {
        const driver = await Driver.findById(String(driverId))
          .select('name phone vehicleNumber vehicleType rating');
        const pos = activeVehiclePositions.get(String(driverId));
        socket.emit(`booking:${bookingId}`, {
          action: 'accept',
          driver: driver ? {
            name:          driver.name,
            phone:         driver.phone,
            vehicleNumber: driver.vehicleNumber,
            vehicleType:   driver.vehicleType,
            rating:        driver.rating || 4.5,
            driverId:      String(driver._id),
            eta:           '3–5 min',
          } : null,
          location: pos ? { lat: pos.lat, lng: pos.lng } : null,
        });
      }
    });

    // ── Driver: register into their personal room ──────────────
    socket.on('driver:register', ({ driverId }) => {
      if (!driverId) return;
      connectedDrivers.set(socket.id, String(driverId));
      socket.join(`driver:${String(driverId)}`);
      console.log(`[Socket] Driver registered: ${driverId}`);
    });

    // ── Driver: location broadcast ─────────────────────────────
    socket.on('driver:location', async (data) => {
      const {
        driverId, lat, lng, bearing, speed, status,
        type, vehicleNumber, busName, routeFrom, routeTo, routeNumber,
      } = data;
      if (!lat || !lng) return;

      const posPayload = {
        id: driverId, lat, lng, bearing, speed, status,
        type, vehicleNumber,
        busName:     busName     || '',
        routeFrom:   routeFrom   || '',
        routeTo:     routeTo     || '',
        routeNumber: routeNumber || '',
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

      // Also push live location to the specific booking room
      // so the matched rider gets precise driver tracking after accept
      for (const [bookingId, bDriverId] of activeBookings.entries()) {
        if (String(bDriverId) === String(driverId)) {
          io.to(`booking:${bookingId}`).emit('driver:locationUpdate', {
            driverId, lat, lng, bearing, speed,
          });
          break;
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
      if (!rideId || !action) return;
      if (action === 'accept') {
        const driverId = connectedDrivers.get(socket.id);
        if (driverId) activeBookings.set(String(rideId), driverId);
      }
      io.to(`booking:${rideId}`).emit(`booking:${rideId}`, {
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
      const driverId = activeBookings.get(String(bookingId));
      // Notify the rider's booking room
      io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, {
        action:    'completed',
        bookingId: String(bookingId),
        driverId:  driverId ? String(driverId) : null,
      });
      activeBookings.delete(String(bookingId));
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
            io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, {
              action:    'driver_offline',
              bookingId: String(bookingId),
              driverId:  String(driverId),
            });
            activeBookings.delete(bookingId);
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
        'location.updatedAt': { $lt: new Date(Date.now() - 60000) },
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
            console.log(`[Socket] Stale driver ${d._id} — rider for booking ${bookingId} notified`);
            break;
          }
        }

        io.emit('driver:offline', { driverId: d._id });
      }
    } catch {}
  }, 60000); // FIX: Run every 60 seconds for tighter tracking
};
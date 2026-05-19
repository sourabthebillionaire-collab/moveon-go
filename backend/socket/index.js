const { Driver } = require('../models');

module.exports = function initSocket(io) {
  const connectedDrivers       = new Map(); // socketId → driverId
  const activeVehiclePositions = new Map(); // driverId → latest position
  const activeBookings         = new Map(); // bookingId → driverId (set on accept)
  io.activeBookings = activeBookings;

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── Rider: send snapshot + join their booking room ──────────
    socket.on('rider:connected', () => {
      const snapshot = Array.from(activeVehiclePositions.values());
      socket.emit('vehicles:snapshot', snapshot);
    });

    // ✅ FIX 1 — Rider joins a dedicated room for their booking
    // Called immediately after POST /api/bookings returns a bookingId
    socket.on('rider:joinBooking', async ({ bookingId }) => {
      if (!bookingId) return;
      socket.join(`booking:${bookingId}`);
      console.log(`[Socket] Rider joined room booking:${bookingId}`);

      // If the driver already accepted (race: driver was very fast), replay it.
      // Provide the full driver snapshot so the rider page can restore gracefully.
      const driverId = activeBookings.get(String(bookingId));
      if (driverId) {
        const driver = await Driver.findById(String(driverId)).select('name phone vehicleNumber vehicleType rating');
        const pos = activeVehiclePositions.get(String(driverId));
        socket.emit(`booking:${bookingId}`, {
          action:   'accept',
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
      socket.join(`driver:${driverId}`);
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

      // ✅ FIX 2 — Also push live location to the specific booking room
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

    // ── Rider: live location updates for accepted booking ─────────
    socket.on('rider:location', (data) => {
      const { bookingId, lat, lng, bearing, speed } = data || {};
      if (!bookingId || lat == null || lng == null) return;
      const driverId = activeBookings.get(String(bookingId));
      if (!driverId) return;
      io.to(`driver:${driverId}`).emit('rider:locationUpdate', {
        bookingId, lat, lng, bearing, speed,
      });
    });

    // ✅ FIX 3 — ride:respond is now a FALLBACK ONLY path
    // The primary path is HTTP POST /api/bookings/:id/respond which
    // emits to the room with full driver details via global.io.
    // This handler covers the edge case where the HTTP call fails but
    // the socket is still alive. It emits to the ROOM (not broadcast).
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

    // ── Trip ended — clean up booking tracking ─────────────────
    socket.on('trip:ended', ({ bookingId }) => {
      if (bookingId) activeBookings.delete(String(bookingId));
    });

    // ── Disconnect ─────────────────────────────────────────────
    socket.on('disconnect', async () => {
      const driverId = connectedDrivers.get(socket.id);
      if (driverId) {
        connectedDrivers.delete(socket.id);
        activeVehiclePositions.delete(String(driverId));

        // Remove from any active booking
        for (const [bookingId, bDriverId] of activeBookings.entries()) {
          if (String(bDriverId) === String(driverId)) {
            activeBookings.delete(bookingId);
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
        'location.updatedAt': { $lt: new Date(Date.now() - 120000) },
      });
      for (const d of stale) {
        await Driver.updateOne({ _id: d._id }, { status: 'offline', onDuty: false });
        activeVehiclePositions.delete(String(d._id));
        io.emit('driver:offline', { driverId: d._id });
      }
    } catch {}
  }, 120000);
};
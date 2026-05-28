const { Driver, Booking } = require('../models');
const jwt = require('jsonwebtoken');
const { socketHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Helper for distance calculation (km)
function getDist(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

module.exports = function initSocket(io) {
  const connectedDrivers = new Map();
  // These maps are initialized in server.js, so we can directly access them.
  const { activeVehiclePositions, activeBookings, driverToBooking, arrivedNotified } = io;

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ── Rider: send snapshot + join their booking room ──────────
    socket.on('rider:connected', socketHandler(socket, (data) => {
      const { lat, lng } = data || {};
      // Validate lat/lng before using in distance calculation
      const isNum = (v) => typeof v === 'number' && !isNaN(v);
      if (!isNum(lat) || !isNum(lng)) return; // Do not filter if coords are invalid

      let snapshot = Array.from(activeVehiclePositions.values());
      // ✅ PERFORMANCE: Filter snapshot to only show vehicles within a 20km radius.
      // This significantly reduces the payload size and prevents client-side rendering lag.
      if (lat != null && lng != null) {
        snapshot = snapshot.filter(v => {
          if (v.lat == null || v.lng == null) return false;
          return getDist(lat, lng, v.lat, v.lng) <= 20;
        });
      }

      socket.emit('vehicles:snapshot', snapshot);
    }));

    // Rider joins a dedicated room for their booking.
    // Called immediately after POST /api/bookings returns a bookingId.
    // If the driver already accepted (race condition), replay the accept event.
    socket.on('rider:joinBooking', socketHandler(socket, async ({ bookingId, token, lat, lng }) => {
      const bId = bookingId ? String(bookingId).trim() : null; // BUG 1: Ensure trimmed string
      if (!bId || !token) {
        logger.warn(`Rider joinBooking attempt missing ID or token: Socket ${socket.id}`);
        return;
      }

      // ✅ SECURITY: Verify JWT Token
      let userId;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'user') {
          logger.warn(`Unauthorized rider:joinBooking attempt: Socket ${socket.id} has wrong token type`);
          return;
        }
        userId = decoded.id;
      } catch (err) {
        logger.error(`Rider JWT verification failed for socket ${socket.id}: ${err.message}`);
        return;
      }

      // ✅ OPTIMIZATION: Fetch all recovery data in one atomic query
      const booking = await Booking.findById(bId).select('userId driverId startOTP status pickupLat pickupLng').lean();
      
      if (!booking || String(booking.userId) !== String(userId)) {
        logger.warn(`Unauthorized rider:joinBooking: User ${userId} access denied to ${bId}`);
        return;
      }

      socket.join(`booking:${bId}`);
      socket.join(`user:${userId}`); // Ensure user is also in a private room
      logger.info(`[Socket] Rider ${userId} joined room booking:${bId}`);

      // ✅ SESSION RECOVERY: Restore tracking state from DB if memory maps are empty (e.g. server restart)
      let driverId = activeBookings.get(bId);
      if (!driverId && booking.driverId) {
        driverId = String(booking.driverId);
      }
      
      if (driverId) {
        const dId = String(driverId);
        // Ensure driver is still active and approved
        const driverDoc = await Driver.findById(dId).select('isApproved isActive').lean();
        if (!driverDoc || !driverDoc.isApproved || !driverDoc.isActive) {
          logger.warn(`Rider joinBooking: Assigned driver ${dId} is no longer active/approved.`);
          driverId = null; // Invalidate driverId if not active/approved
        }
      }

      if (driverId) { // Re-check driverId after potential invalidation
        activeBookings.set(bId, dId);
        driverToBooking.set(dId, bId);
        
        const driver = await Driver.findById(dId).select('name phone vehicleNumber vehicleType rating').lean();
        const pos = activeVehiclePositions.get(dId);
        
        const action = booking.status === 'started' ? 'started' : 'accept';

        socket.emit(`booking:${bId}`, {
          action,
          otp:    booking.startOTP,
          driver: driver ? {
            name:          driver.name,
            phone:         driver.phone,
            vehicleNumber: driver.vehicleNumber,
            vehicleType:   driver.vehicleType,
            rating:        driver.rating || 4.5,
            driverId:      String(driver._id),
            eta:           '3–5 min',
            location:      pos ? { lat: pos.lat, lng: pos.lng, bearing: pos.bearing, speed: pos.speed } : null,
          } : null,
          location: pos ? { lat: pos.lat, lng: pos.lng } : null,
        });
      }
    }));

    // ── Viewer: join for public tracking (No token required) ──────
    socket.on('viewer:joinBooking', socketHandler(socket, async ({ bookingId }) => {
      const bId = bookingId ? String(bookingId).trim() : null;
      if (!bId) return;

      const booking = await Booking.findById(bId).select('status driverId').lean();
      // Only allow joining if trip is active
      if (!booking || !['accepted', 'started'].includes(booking.status)) return;

      socket.join(`booking:${bId}`);
      logger.info(`[Socket] Public Viewer joined room booking:${bId}`);

      const driverId = booking.driverId || activeBookings.get(bId);
      if (driverId) {
        const dId = String(driverId);
        const [driver, pos] = await Promise.all([
          Driver.findById(dId).select('name vehicleNumber vehicleType rating').lean(),
          Promise.resolve(activeVehiclePositions.get(dId))
        ]);

        socket.emit(`booking:${bId}`, {
          action: booking.status === 'started' ? 'started' : 'accept',
          driver: driver ? {
            name:          driver.name,
            vehicleNumber: driver.vehicleNumber,
            vehicleType:   driver.vehicleType,
            rating:        driver.rating || 4.5,
            driverId:      dId,
            location:      pos ? { lat: pos.lat, lng: pos.lng } : null,
          } : null,
          location: pos ? { lat: pos.lat, lng: pos.lng } : null,
        });
      }
    }));

    // ── Driver: register into their personal room ──────────────
    socket.on('driver:register', socketHandler(socket, async ({ driverId, vehicleType, token }) => {
      if (!driverId || !token) {
        logger.warn(`Driver register attempt missing ID or token: Socket ${socket.id}`);
        return;
      }

      const dId = String(driverId);

      // ✅ SECURITY: Verify JWT Token before allowing registration
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.type !== 'driver' || String(decoded.id) !== dId) {
          logger.warn(`Unauthorized driver:register attempt: Socket ${socket.id} tried to register as ${dId}`);
          return;
        }
      } catch (err) {
        logger.error(`Driver JWT verification failed for socket ${socket.id}: ${err.message}`);
        return;
      }

      // World-Class Refinement: Clean up existing socket connections for this driver
      // to prevent "split-brain" tracking state.
      for (const [sid, existingId] of connectedDrivers.entries()) {
        if (existingId === dId && sid !== socket.id) {
          io.sockets.sockets.get(sid)?.disconnect();
          connectedDrivers.delete(sid);
          activeVehiclePositions.delete(dId); // Remove stale position for the old socket
        }
      }

      connectedDrivers.set(socket.id, dId);
      socket.join(`driver:${dId}`);
      
      // ✅ DISPATCH ROOM: Must be lowercase to match bookings.js
      // FIX: Fetch vehicleType from DB, not client, for security
      const driverDoc = await Driver.findById(dId).select('vehicleType').lean();
      if (driverDoc?.vehicleType) {
        const typeStr = String(driverDoc.vehicleType).trim().toLowerCase();
        const roomName = `drivers:${typeStr}`;
        socket.join(roomName);
        // Also join a general 'drivers' room for global events if needed
        socket.join('drivers');
        logger.info(`[Socket] Driver ${dId} joined dispatch pool: ${roomName}`);
      }

      // ✅ RECOVERY: Restore active booking mapping if driver is already mid-trip
      const activeBooking = await Booking.findOne({ 
        driverId: dId, 
        status: { $in: ['accepted', 'started'] } 
      }).select('_id').lean();
      
      if (activeBooking) {
        const bId = String(activeBooking._id);
        activeBookings.set(bId, dId);
        driverToBooking.set(dId, bId);
        logger.info(`[Socket] Restored active mapping for Driver ${dId} -> Booking ${bId}`);
      }
    });

    // ── Driver: location broadcast ─────────────────────────────
    socket.on('driver:location', async (data) => {
      const {
        driverId, lat, lng, bearing, speed, status,
        type, vehicleNumber, busName, routeFrom, routeTo, routeNumber, passengers, capacity
      } = data;
      
      // ✅ SECURITY: Prevent malicious clients from spoofing other drivers
      const registeredId = connectedDrivers.get(socket.id);
      if (!registeredId || String(driverId) !== String(registeredId)) {
        logger.warn(`Unauthorized location attempt: Socket ${socket.id} tried to update Driver ${driverId}`);
        return;
      }

      // FIX: Fetch driver details from DB for security and consistency
      const driverDoc = await Driver.findById(registeredId).select('vehicleType vehicleNumber busName routeFrom routeTo routeNumber').lean();
      if (!driverDoc) return; // Driver not found in DB, should not happen after auth

      // Harden Validation: Ensure numbers exist and are within valid ranges
      const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
      if (!isNum(lat) || !isNum(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return; // Invalid coordinates, ignore update
      }

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
      // Overwrite client-provided details with DB-verified details for posPayload
      posPayload.type = driverDoc.vehicleType;
      posPayload.vehicleNumber = driverDoc.vehicleNumber;
      if (driverDoc.vehicleType === 'bus') { // Only apply bus-specific details if it's a bus
        posPayload.busName = driverDoc.busName || '';
        posPayload.routeFrom = driverDoc.routeFrom || '';
        posPayload.routeTo = driverDoc.routeTo || '';
        posPayload.routeNumber = driverDoc.routeNumber || '';
      }

      activeVehiclePositions.set(String(driverId), posPayload);

      try {
        await Driver.updateOne({ _id: driverId }, {
          'location.lat':       lat,
          'location.lng':       lng,
          'location.bearing':   bearing || 0,
          'location.speed':     speed   || 0,
          'location.updatedAt': new Date(),
          status:               status  || 'active', // Update status based on client, but onDuty is separate
          // onDuty is controlled by the /duty endpoint, not implicitly by location updates
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
          const dist = getDist(lat, lng, bookingData.pickupLat, bookingData.pickupLng); // Distance in KM
          if (dist < 0.2 && !arrivedNotified.has(String(activeBookingId))) { // 200 meters threshold
            if (arrivedNotified instanceof Set) arrivedNotified.add(String(activeBookingId));
            io.to(`booking:${activeBookingId}`).emit(`booking:${activeBookingId}`, { 
              action: 'driver_arrived',
              message: 'Your driver has arrived at the pickup location!' 
            });
          }
          console.log(`[Socket] Driver ${driverId} arrived at booking ${activeBookingId}`);
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
      io.arrivedNotified?.delete(String(bookingId)); // FIX: Clean up notification tracking
      if (driverId) driverToBooking.delete(String(driverId));
      console.log(`[Socket] trip:ended for booking ${bookingId} — rider notified`);
    });

    // ── Ride Health: stationary alert ──────────────────────────
    socket.on('ride:healthAlert', socketHandler(socket, async ({ bookingId, driverId, reason }) => {
      if (!bookingId) return;

      const isGpsLost = reason === 'GPS_LOST';
      const msg = isGpsLost 
        ? 'GPS connection lost: We are monitoring the trip status for your safety.'
        : 'Stationary alert: We are monitoring the driver status for your safety.';

      logger.warn(`[Ride Health] ${isGpsLost ? 'GPS Lost' : 'Stationary'} alert`, { bookingId, driverId });
      
      io.to(`booking:${bookingId}`).emit(`booking:${bookingId}`, {
        action: 'health_alert',
        message: msg
      });
    }));

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
            if (arrivedNotified instanceof Set) arrivedNotified.delete(bIdStr);
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
        'location.updatedAt': { $lt: new Date(Date.now() - 60000) }, // 60s stale threshold
      }).select('_id'); // Optimization: only fetch IDs
      for (const d of stale) {
        await Driver.updateOne({ _id: d._id }, { status: 'offline', onDuty: false });
        
        const dIdStr = String(d._id);
        activeVehiclePositions.delete(dIdStr);

        // ── BUG FIX #3 ───────────────────────────────────────────
        for (const [bookingId, bDriverId] of activeBookings.entries()) {
          if (String(bDriverId) === dIdStr) {
            const bIdStr = String(bookingId);
            io.to(`booking:${bIdStr}`).emit(`booking:${bIdStr}`, {
              action:    'driver_offline',
              bookingId: bIdStr,
              driverId:  dIdStr,
            });
            activeBookings.delete(bookingId);
            if (arrivedNotified instanceof Set) arrivedNotified.delete(bIdStr);
            driverToBooking.delete(dIdStr);
            console.log(`[Socket] Stale driver ${dIdStr} — rider for booking ${bookingId} notified`);
            break;
          }
        }

        io.emit('driver:offline', { driverId: d._id });
      }
    } catch (err) { logger.error(`Stale driver cleanup error: ${err.message}`); }
  }, 60000); 
};
const { Driver } = require('../models');

module.exports = function initSocket(io) {
  const connectedDrivers       = new Map(); // socketId → driverId
  const activeVehiclePositions = new Map(); // driverId → latest position

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // Rider connects — send snapshot of all active vehicles immediately
    socket.on('rider:connected', () => {
      const snapshot = Array.from(activeVehiclePositions.values());
      socket.emit('vehicles:snapshot', snapshot);
    });

    socket.on('driver:register', ({ driverId }) => {
      if (!driverId) return;
      connectedDrivers.set(socket.id, driverId);
      socket.join(`driver:${driverId}`);
    });

    socket.on('driver:location', async (data) => {
      const { driverId, lat, lng, bearing, speed, status, type, vehicleNumber, busName, routeFrom, routeTo, routeNumber } = data;
      if (!lat || !lng) return;

      // ✅ Cache latest position including bus name and route
      activeVehiclePositions.set(String(driverId), {
        id: driverId, lat, lng, bearing, speed, status,
        type, vehicleNumber,
        busName:     busName     || '',
        routeFrom:   routeFrom   || '',
        routeTo:     routeTo     || '',
        routeNumber: routeNumber || '',
        ts: Date.now(),
      });

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

      // ✅ Broadcast with bus name and route info so map popup shows it
      io.emit('vehicles:update', {
        id: driverId, lat, lng, bearing, speed, status,
        type, vehicleNumber,
        busName:     busName     || '',
        routeFrom:   routeFrom   || '',
        routeTo:     routeTo     || '',
        routeNumber: routeNumber || '',
        ts: Date.now(),
      });

      if (status === 'SOS') {
        console.warn(`[SOS] Driver ${driverId} at ${lat},${lng}`);
        io.emit('driver:sos', { driverId, lat, lng, ts: Date.now() });
      }
    });

    socket.on('ride:respond', ({ rideId, action }) => {
      io.emit(`booking:${rideId}`, { action });
    });

    socket.on('disconnect', async () => {
      const driverId = connectedDrivers.get(socket.id);
      if (driverId) {
        connectedDrivers.delete(socket.id);
        activeVehiclePositions.delete(String(driverId));
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
const { Driver } = require('../models');

module.exports = function initSocket(io) {
  const connectedDrivers      = new Map(); // socketId → driverId
  const activeVehiclePositions = new Map(); // driverId → latest position data ✅ NEW

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // ✅ NEW — rider asks for snapshot of all currently active vehicles
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
      const { driverId, lat, lng, bearing, speed, status, type, vehicleNumber, number } = data;
      if (!lat || !lng) return;

      // ✅ Cache latest position so new riders get it in snapshot
      activeVehiclePositions.set(String(driverId), {
        id: driverId, lat, lng, bearing, speed, status,
        type, vehicleNumber, number, ts: Date.now(),
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

      // Broadcast single vehicle update to everyone
      io.emit('vehicles:update', { id: driverId, lat, lng, bearing, speed, status, type, vehicleNumber, number, ts: Date.now() });

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
        activeVehiclePositions.delete(String(driverId)); // ✅ Remove from snapshot cache
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
        activeVehiclePositions.delete(String(d._id)); // ✅ Remove from snapshot cache
        io.emit('driver:offline', { driverId: d._id });
      }
    } catch {}
  }, 120000);
};

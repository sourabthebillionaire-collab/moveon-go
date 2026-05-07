const { Driver } = require('../models');

module.exports = function initSocket(io) {
  const connectedDrivers = new Map();

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    socket.on('driver:register', ({ driverId }) => {
      if (!driverId) return;
      connectedDrivers.set(socket.id, driverId);
      socket.join(`driver:${driverId}`);
    });

    socket.on('driver:location', async (data) => {
      const { driverId, lat, lng, bearing, speed, status } = data;
      if (!lat || !lng) return;

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

      io.emit('vehicles:update', { id: driverId, lat, lng, bearing, speed, status, ts: Date.now() });

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
      const stale = await Driver.find({ onDuty: true, 'location.updatedAt': { $lt: new Date(Date.now() - 120000) } });
      for (const d of stale) {
        await Driver.updateOne({ _id: d._id }, { status: 'offline', onDuty: false });
        io.emit('driver:offline', { driverId: d._id });
      }
    } catch {}
  }, 120000);
};

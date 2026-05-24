const router = require('express').Router();
const { Driver } = require('../models');
const { asyncHandler } = require('../utils/errorHandler');

// GET /api/vehicles/nearby?lat=&lng=&type=
router.get('/nearby', asyncHandler(async (req, res) => {
    const { lat, lng, type } = req.query;
    if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required.' });

    const radiusKm = 10;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(parseFloat(lat) * Math.PI / 180));

    const query = {
      onDuty:   true,
      isActive: true,
      status:   { $in: ['active', 'busy'] },
      'location.lat': { $gte: parseFloat(lat) - latDelta, $lte: parseFloat(lat) + latDelta },
      'location.lng': { $gte: parseFloat(lng) - lngDelta, $lte: parseFloat(lng) + lngDelta },
      'location.updatedAt': { $gte: new Date(Date.now() - 60000) },
    };

    if (type && type !== 'all') query.vehicleType = type;

    const drivers = await Driver.find(query).select('vehicleId vehicleNumber vehicleType location status');

    const vehicles = drivers.map(d => ({
      id:            d._id,
      vehicleId:     d.vehicleId,
      vehicleNumber: d.vehicleNumber,
      type:          d.vehicleType,
      lat:           d.location.lat,
      lng:           d.location.lng,
      bearing:       d.location.bearing,
      speed:         d.location.speed,
      status:        d.status,
    }));

    res.json({ vehicles, count: vehicles.length });
}));

// GET /api/vehicles/:id
router.get('/:id', asyncHandler(async (req, res) => {
    const driver = await Driver.findById(req.params.id).select('-pinHash');
    if (!driver) return res.status(404).json({ message: 'Vehicle not found.' });
    res.json({ vehicle: driver });
}));

module.exports = router;

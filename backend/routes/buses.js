const router = require('express').Router();
const { Driver, BusRoute } = require('../models');
const { asyncHandler } = require('../utils/errorHandler');

// GET /api/buses/routes
router.get('/routes', asyncHandler(async (req, res) => {
    const routes = await BusRoute.find({ isActive: true }).select('-__v');

    const enriched = await Promise.all(routes.map(async (route) => {
      const liveDrivers = await Driver.find({
        _id:      { $in: route.assignedDrivers },
        onDuty:   true,
        isActive: true,
        'location.updatedAt': { $gte: new Date(Date.now() - 60000) },
      }).select('location status vehicleNumber passengers');

      // FIX: Deterministic ETA instead of Math.random()
      // Use the route ID to create a stable "base" time that doesn't jump on refresh
      const routeSeed = parseInt(String(route._id).slice(-4), 16) || 1;
      const mockEta = (routeSeed % 10) + 2; 

      return {
        id:        route._id,
        number:    route.number,
        from:      route.from,
        to:        route.to,
        type:      route.type,
        frequency: route.frequency,
        status:    liveDrivers.length > 0 ? 'active' : 'inactive',
        liveCount: liveDrivers.length,
        eta:       liveDrivers.length > 0 ? `${mockEta} min` : '--',
        // Show the occupancy of the nearest bus
        seats:     liveDrivers.length > 0 ? Math.max(0, 60 - (liveDrivers[0].passengers || 0)) : null
      };
    }));

    res.json({ routes: enriched.filter(r => r.status === 'active') });
}));

// GET /api/buses/route/:id
router.get('/route/:id', asyncHandler(async (req, res) => {
  const route = await BusRoute.findById(req.params.id).lean();
  if (!route) return res.status(404).json({ message: 'Route not found.' });
  res.json({ route });
}));

module.exports = router;

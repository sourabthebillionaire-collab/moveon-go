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
      }).select('location status vehicleNumber');

      return {
        id:        route._id,
        number:    route.number,
        from:      route.from,
        to:        route.to,
        type:      route.type,
        frequency: route.frequency,
        status:    liveDrivers.length > 0 ? 'active' : 'inactive',
        liveCount: liveDrivers.length,
        eta:       liveDrivers.length > 0 ? `${2 + Math.floor(Math.random() * 8)} min` : '--',
      };
    }));

    res.json({ routes: enriched.filter(r => r.status === 'active') });
}));

module.exports = router;

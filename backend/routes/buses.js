const router = require('express').Router();
const { Driver, BusRoute } = require('../models');

// GET /api/buses/routes
router.get('/routes', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bus routes.' });
  }
});

module.exports = router;

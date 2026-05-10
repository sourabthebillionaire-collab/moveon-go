// fare.js
const fareRouter = require('express').Router();
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

fareRouter.post('/estimate', asyncHandler(async (req, res) => {
  const { from, to, vehicleType } = req.body;
  if (!from || !to || !vehicleType) {
    logger.warn('Fare estimate: missing required fields');
    return res.status(400).json({ message: 'from, to and vehicleType required.' });
  }

  const distKm = haversine(from.lat, from.lng, to.lat, to.lng);
  const rates  = { auto: { base:25, per:14 }, cab: { base:60, per:16 }, bike: { base:20, per:8 } };
  const r      = rates[vehicleType] || rates.auto;
  const amt    = Math.round(r.base + distKm * r.per);

  logger.info('Fare estimated', { vehicleType, distanceKm: distKm.toFixed(1), amount: amt });

  res.json({
    min: Math.round(amt*0.9), max: Math.round(amt*1.1), avg: amt,
    display: `₹${Math.round(amt*0.9)}–₹${Math.round(amt*1.1)}`,
    distanceKm: distKm.toFixed(1),
  });
}));

module.exports = fareRouter;

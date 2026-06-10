// fare.js
const fareRouter = require('express').Router();
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

function haversine(lat1, lon1, lat2, lon2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a    = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  // Clamp value to [0, 1] to prevent NaN from precision errors on antipodal points
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

fareRouter.post('/estimate', asyncHandler(async (req, res) => {
  const { from, to, vehicleType } = req.body;
  if (!from || !to || !vehicleType) {
    logger.warn('Fare estimate: missing required fields');
    return res.status(400).json({ message: 'from, to and vehicleType required.' });
  }

  // FIX: Harden coordinate validation to allow '0' and ensure numeric types.
  // Added range validation: Latitude [-90, 90] and Longitude [-180, 180]
  const isLat = (v) => typeof v === 'number' && !isNaN(v) && v >= -90 && v <= 90;
  const isLng = (v) => typeof v === 'number' && !isNaN(v) && v >= -180 && v <= 180;
  if (!isLat(from?.lat) || !isLng(from?.lng) || !isLat(to?.lat) || !isLng(to?.lng)) {
    logger.warn('Fare estimate: missing or invalid coordinates', { from, to });
    return res.status(400).json({ message: 'Valid numeric coordinates required for from and to.' });
  }

  const distKm = haversine(from.lat, from.lng, to.lat, to.lng);
  const rates  = { auto: { base:25, per:14 }, cab: { base:60, per:16 }, bike: { base:20, per:8 } };
  // SYNC: Support 'Bike' or 'bike' strings from various client versions
  const r      = rates[String(vehicleType).toLowerCase()] || rates.auto;
  const amt    = Math.round(r.base + distKm * r.per);

  logger.info('Fare estimated', { vehicleType, distanceKm: distKm.toFixed(1), amount: amt });

  res.json({
    min: Math.round(amt*0.9), max: Math.round(amt*1.1), avg: amt,
    display: `₹${Math.round(amt*0.9)}–₹${Math.round(amt*1.1)}`,
    distanceKm: distKm.toFixed(1),
  });
}));

module.exports = fareRouter;

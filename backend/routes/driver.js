/**
 * Driver Registration Route
 * POST /api/driver/register  → submit registration form
 * GET  /api/driver/validate/:vehicleId → check vehicle ID
 * POST /api/driver/login     → login with vehicleId + PIN
 * POST /api/driver/location  → update GPS
 * POST /api/driver/duty      → on/off duty
 * GET  /api/driver/me        → get driver profile
 */

const router = require('express').Router();
const bcrypt  = require('bcryptjs');
const { Driver } = require('../models');
const { protectDriver, signToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { authLimiter } = require('../utils/rateLimiter');

// Generate unique Vehicle ID
async function generateVehicleId(vehicleType, vehicleNumber) {
  const prefix = vehicleType.toUpperCase().slice(0, 3);
  const numPart = vehicleNumber.replace(/[^0-9]/g, '').slice(-4) || '0001';
  const base = `MG-${prefix}-${numPart}`;
  // Check if exists, add suffix if needed
  const exists = await Driver.findOne({ vehicleId: base });
  if (!exists) return base;
  const suffix = Math.floor(Math.random() * 900) + 100;
  return `MG-${prefix}-${numPart}-${suffix}`;
}

// POST /api/driver/register
router.post('/register', asyncHandler(async (req, res) => {
  const { name, phone, email, vehicleType, vehicleNumber, pin, address, licenseNumber } = req.body;

  // Validate required fields
  if (!name || !phone || !vehicleType || !vehicleNumber || !pin) {
    logger.warn('Driver register: missing required fields');
    return res.status(400).json({ message: 'Name, phone, vehicle type, vehicle number and PIN are required.' });
  }

  if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
    logger.warn(`Driver register: invalid PIN format from ${phone}`);
    return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
  }

  if (!['bus', 'auto', 'cab', 'bike'].includes(vehicleType)) {
    logger.warn(`Driver register: invalid vehicle type: ${vehicleType}`);
    return res.status(400).json({ message: 'Invalid vehicle type.' });
  }

  // Check if phone already registered
  const existing = await Driver.findOne({ phone: phone.trim() });
  if (existing) {
    logger.warn(`Driver register: phone already registered: ${phone}`);
    return res.status(400).json({ message: 'This phone number is already registered.' });
  }

  // Hash PIN
  const pinHash = await bcrypt.hash(String(pin), 10);

  // Generate Vehicle ID
  const vehicleId = await generateVehicleId(vehicleType, vehicleNumber);

  // Create driver as pending
  const driver = await Driver.create({
    vehicleId,
    name:          name.trim(),
    phone:         phone.trim(),
    email:         email?.trim() || '',
    vehicleType,
    vehicleNumber: vehicleNumber.trim().toUpperCase(),
    pinHash,
    address:       address?.trim() || '',
    licenseNumber: licenseNumber?.trim() || '',
    isApproved:    false,
    isActive:      true,
    status:        'offline',
  });

  logger.info(`Driver registered: ${driver.vehicleId}`, { phone, vehicleType });

  res.status(201).json({
    message:   'Registration submitted successfully. You will be notified once approved by admin.',
    vehicleId: driver.vehicleId,
    name:      driver.name,
  });
}));

// GET /api/driver/validate/:vehicleId
router.get('/validate/:vehicleId', asyncHandler(async (req, res) => {
  const driver = await Driver.findOne({
    vehicleId:  req.params.vehicleId.toUpperCase(),
    isApproved: true,
    isActive:   true,
  }).select('vehicleId vehicleType vehicleNumber name');

  if (!driver) {
    logger.warn(`Vehicle validation failed: ${req.params.vehicleId}`);
    return res.status(404).json({ message: 'Vehicle ID not found or not yet approved. Contact admin.' });
  }

  logger.info(`Vehicle validated: ${driver.vehicleId}`);
  res.json({ valid: true, vehicleId: driver.vehicleId, vehicleType: driver.vehicleType, vehicleNumber: driver.vehicleNumber, name: driver.name });
}));

// POST /api/driver/login
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { vehicleId, pin } = req.body;
  if (!vehicleId || !pin) return res.status(400).json({ message: 'Vehicle ID and PIN are required.' });

  const driver = await Driver.findOne({ vehicleId: vehicleId.toUpperCase(), isActive: true });

  if (!driver) {
    logger.warn(`Driver login failed: vehicle not found: ${vehicleId}`);
    return res.status(404).json({ message: 'Vehicle ID not found.' });
  }
  if (!driver.isApproved) {
    logger.warn(`Driver login: pending approval: ${vehicleId}`);
    return res.status(403).json({ message: 'Your registration is pending admin approval. Please wait.' });
  }

  const pinMatch = await bcrypt.compare(String(pin), driver.pinHash);
  if (!pinMatch) {
    logger.warn(`Driver login: incorrect PIN: ${vehicleId}`);
    return res.status(401).json({ message: 'Incorrect PIN. Please try again.' });
  }

  const token = signToken({ id: driver._id, type: 'driver' });

  logger.info(`Driver login successful: ${driver.vehicleId}`);

  res.json({
    message: 'Signed in successfully.',
    token,
    driver: {
      id:            driver._id,
      vehicleId:     driver.vehicleId,
      name:          driver.name,
      phone:         driver.phone,
      vehicleType:   driver.vehicleType,
      vehicleNumber: driver.vehicleNumber,
      rating:        driver.rating,
      totalTrips:    driver.totalTrips,
    },
  });
}));

// POST /api/driver/location
router.post('/location', protectDriver, asyncHandler(async (req, res) => {
  const { lat, lng, bearing, speed, status } = req.body;
  if (!lat || !lng) return res.status(400).json({ message: 'lat and lng required.' });

  await Driver.updateOne({ _id: req.driver._id }, {
    'location.lat':       lat,
    'location.lng':       lng,
    'location.bearing':   bearing || 0,
    'location.speed':     speed   || 0,
    'location.updatedAt': new Date(),
    status:               status  || 'active',
  });

  logger.debug(`Driver location updated: ${req.driver.vehicleId}`, { lat, lng });

  if (global.io) {
    global.io.emit('vehicles:update', {
      id: req.driver._id, vehicleId: req.driver.vehicleId,
      vehicleNumber: req.driver.vehicleNumber, type: req.driver.vehicleType,
      lat, lng, bearing, speed, status: status || 'active',
    });
  }

  res.json({ message: 'Location updated.' });
}));

// POST /api/driver/duty
router.post('/duty', protectDriver, asyncHandler(async (req, res) => {
  const { onDuty } = req.body;
  await Driver.updateOne({ _id: req.driver._id }, { onDuty, status: onDuty ? 'active' : 'offline' });
  
  logger.info(`Driver duty status: ${req.driver.vehicleId} - ${onDuty ? 'ON DUTY' : 'OFF DUTY'}`);
  
  res.json({ message: onDuty ? 'You are now on duty.' : 'You are now off duty.' });
}));

// GET /api/driver/me
router.get('/me', protectDriver, (req, res) => {
  res.json({ driver: req.driver });
});

module.exports = router;

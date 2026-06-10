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
  // BUG FIX #2: Use timestamp component to further reduce collision risk in high concurrency
  const salt = Date.now().toString().slice(-2);
  const numPart = vehicleNumber.replace(/[^A-Z0-9]/gi, '').slice(-4).padStart(4, '0');
  const base = `MG-${prefix}-${numPart}-${salt}`;
  // Check if exists, add suffix if needed
  const exists = await Driver.findOne({ vehicleId: base });
  if (!exists) return base;
  const suffix = Math.floor(Math.random() * 900) + 100;
  return `MG-${prefix}-${numPart}-${suffix}`;
}

// POST /api/driver/register
router.post('/register', asyncHandler(async (req, res) => {
  const { name, phone, email, vehicleType, vehicleNumber, pin, address, licenseNumber, busName, routeFrom, routeTo, routeNumber, insuranceDoc } = req.body;

  // Validate required fields
  if (!name || !phone || !vehicleType || !vehicleNumber || !pin) {
    logger.warn('Driver register: missing required fields');
    return res.status(400).json({ message: 'Name, phone, vehicle type, vehicle number, and PIN are required.' });
  }

  // FIX: Validate phone number (must be 10 digits)
  const normalizedPhone = String(phone).trim().replace(/[^0-9+]/g, '');
  const phoneDigits = normalizedPhone.replace(/\D/g, '');
  if (phoneDigits.length !== 10) {
    logger.warn(`Driver register: invalid phone: ${phone}`);
    return res.status(400).json({ message: 'Phone number must be exactly 10 digits.' });
  }

  // FIX: Validate name (not empty, reasonable length)
  const trimmedName = String(name).trim();
  if (trimmedName.length < 2 || trimmedName.length > 100) {
    logger.warn(`Driver register: invalid name length: ${trimmedName.length}`);
    return res.status(400).json({ message: 'Name must be between 2 and 100 characters.' });
  }

  // FIX: Validate email format (if provided)
  if (email && email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      logger.warn(`Driver register: invalid email: ${email}`);
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }
  }

  // FIX: Validate vehicle number format
  const vehicleNum = String(vehicleNumber).trim().toUpperCase();
  if (vehicleNum.length < 3 || vehicleNum.length > 20 || !/^[A-Z0-9\-]*$/.test(vehicleNum)) {
    logger.warn(`Driver register: invalid vehicle number: ${vehicleNumber}`);
    return res.status(400).json({ message: 'Vehicle number must be 3-20 characters (letters, numbers, hyphens only).' });
  }

  // FIX: Validate license number (if provided)
  if (licenseNumber && licenseNumber.trim()) {
    const licenseNum = String(licenseNumber).trim();
    if (licenseNum.length < 4 || licenseNum.length > 20) {
      logger.warn(`Driver register: invalid license number: ${licenseNumber}`);
      return res.status(400).json({ message: 'License number must be between 4 and 20 characters.' });
    }
  }

  const pinStr = String(pin).trim();
  if (pinStr.length !== 4 || !/^\d{4}$/.test(pinStr)) {
    logger.warn(`Driver register: invalid PIN format from ${phone}`);
    return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
  }

  if (!['bus', 'auto', 'cab', 'bike'].includes(vehicleType)) {
    logger.warn(`Driver register: invalid vehicle type: ${vehicleType}`);
    return res.status(400).json({ message: 'Invalid vehicle type.' });
  }

  // Check if phone already registered
  const existing = await Driver.findOne({ phone: normalizedPhone });
  if (existing) {
    logger.warn(`Driver register: phone already registered: ${normalizedPhone}`);
    return res.status(400).json({ message: 'This phone number is already registered.' });
  }

  // Hash PIN
  const pinHash = await bcrypt.hash(pinStr, 10);

  // Generate Vehicle ID
  const vehicleId = await generateVehicleId(vehicleType, vehicleNum);

  // Create driver as pending
  const driver = await Driver.create({
    vehicleId,
    name:          trimmedName,
    phone:         normalizedPhone,
    email:         email?.trim() || '',
    vehicleType,
    vehicleNumber: vehicleNum,
    pinHash,
    address:       address?.trim() || '',
    licenseNumber: licenseNumber?.trim() || '',
    insuranceDoc:  insuranceDoc?.trim() || '',
    busName:       vehicleType === 'bus' ? (busName?.trim() || '') : '',
    routeFrom:     vehicleType === 'bus' ? (routeFrom?.trim() || '') : '',
    routeTo:       vehicleType === 'bus' ? (routeTo?.trim() || '') : '',
    routeNumber:   vehicleType === 'bus' ? (routeNumber?.trim() || '') : '',
    isApproved:    false,
    isActive:      true,
    status:        'offline',
  });

  logger.info(`Driver registered: ${driver.vehicleId}`, { phone: normalizedPhone, vehicleType });

  // ✅ REAL-TIME UI UPDATE: Notify admins about the new pending registration
  if (global.io) {
    global.io.to('admins').emit('admin:driverUpdated', { 
      action: 'registered', 
      driver: { id: driver._id, vehicleId: driver.vehicleId, name: driver.name, status: 'pending' } 
    });
  }

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
    isActive:   true,
  }).select('vehicleId vehicleType vehicleNumber name isApproved');

  if (!driver) {
    logger.warn(`Vehicle validation failed: ${req.params.vehicleId}`);
    return res.status(404).json({ message: 'Vehicle ID not found. Contact admin.' });
  }

  if (!driver.isApproved) {
    logger.warn(`Vehicle validation: pending approval: ${req.params.vehicleId}`);
    return res.status(403).json({ message: 'Your registration is pending admin approval. Please wait.' });
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
      busName:       driver.busName,
      routeFrom:     driver.routeFrom,
      routeTo:       driver.routeTo,
      routeNumber:   driver.routeNumber,
    },
  });
}));

// POST /api/driver/location
router.post('/location', protectDriver, asyncHandler(async (req, res) => {
  const { lat, lng, bearing, speed, status } = req.body;
  
  // FIX: Harden coordinate validation to prevent NaN or non-numeric storage
  const isNum = (v) => typeof v === 'number' && !isNaN(v);
  if (!isNum(lat) || !isNum(lng)) return res.status(400).json({ message: 'Valid numeric lat and lng required.' });

  const update = {
    'location.lat':       lat,
    'location.lng':       lng,
    'location.bearing':   bearing || 0,
    'location.speed':     speed   || 0,
    'location.updatedAt': new Date(),
    status:               status  || 'active',
    onDuty:               status !== 'offline',
  };

  await Driver.updateOne({ _id: req.driver._id }, update);

  const posPayload = {
    id: req.driver._id, vehicleId: req.driver.vehicleId,
    vehicleNumber: req.driver.vehicleNumber, type: req.driver.vehicleType,
    busName:       req.driver.busName   || '',
    routeFrom:     req.driver.routeFrom || '',
    routeTo:       req.driver.routeTo   || '',
    routeNumber:   req.driver.routeNumber || '',
    lat, lng, bearing, speed, status: status || 'active',
    ts: Date.now(),
  };

  logger.debug(`Driver location updated: ${req.driver.vehicleId}`, { lat, lng });

  if (global.io) {
    // Broadcast to map
    global.io.emit('vehicles:update', posPayload);
    
    // Sync with snapshot state
    if (global.io.activeVehiclePositions) {
      global.io.activeVehiclePositions.set(String(req.driver._id), posPayload);
    }

    // FIX: Notify matched rider even via REST update
    if (global.io.driverToBooking) {
      const bookingId = global.io.driverToBooking.get(String(req.driver._id));
      if (bookingId) {
        global.io.to(`booking:${bookingId}`).emit('driver:locationUpdate', {
          driverId: req.driver._id, lat, lng, bearing, speed,
        });
      }
    }
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
router.get('/me', protectDriver, asyncHandler(async (req, res) => {
  res.json({ driver: req.driver });
}));

// POST /api/driver/event — Log operational events for monitoring
router.post('/event', protectDriver, asyncHandler(async (req, res) => {
  const { event, details } = req.body;
  logger.error(`Driver Operational Event [${req.driver.vehicleId}]: ${event}`, {
    driverId: req.driver._id,
    ...details
  });
  res.json({ success: true });
}));

module.exports = router;

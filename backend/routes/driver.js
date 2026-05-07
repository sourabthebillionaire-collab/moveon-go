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
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, vehicleType, vehicleNumber, pin, address, licenseNumber } = req.body;

    // Validate required fields
    if (!name || !phone || !vehicleType || !vehicleNumber || !pin) {
      return res.status(400).json({ message: 'Name, phone, vehicle type, vehicle number and PIN are required.' });
    }

    if (String(pin).length !== 4 || !/^\d{4}$/.test(String(pin))) {
      return res.status(400).json({ message: 'PIN must be exactly 4 digits.' });
    }

    if (!['bus', 'auto', 'cab', 'bike'].includes(vehicleType)) {
      return res.status(400).json({ message: 'Invalid vehicle type.' });
    }

    // Check if phone already registered
    const existing = await Driver.findOne({ phone: phone.trim() });
    if (existing) {
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

    res.status(201).json({
      message:   'Registration submitted successfully. You will be notified once approved by admin.',
      vehicleId: driver.vehicleId,
      name:      driver.name,
    });

  } catch (err) {
    console.error('[Driver Register]', err.message);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
});

// GET /api/driver/validate/:vehicleId
router.get('/validate/:vehicleId', async (req, res) => {
  try {
    const driver = await Driver.findOne({
      vehicleId:  req.params.vehicleId.toUpperCase(),
      isApproved: true,
      isActive:   true,
    }).select('vehicleId vehicleType vehicleNumber name');

    if (!driver) {
      return res.status(404).json({ message: 'Vehicle ID not found or not yet approved. Contact admin.' });
    }

    res.json({ valid: true, vehicleId: driver.vehicleId, vehicleType: driver.vehicleType, vehicleNumber: driver.vehicleNumber, name: driver.name });
  } catch (err) {
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/driver/login
router.post('/login', async (req, res) => {
  try {
    const { vehicleId, pin } = req.body;
    if (!vehicleId || !pin) return res.status(400).json({ message: 'Vehicle ID and PIN are required.' });

    const driver = await Driver.findOne({ vehicleId: vehicleId.toUpperCase(), isActive: true });

    if (!driver) return res.status(404).json({ message: 'Vehicle ID not found.' });
    if (!driver.isApproved) return res.status(403).json({ message: 'Your registration is pending admin approval. Please wait.' });

    const pinMatch = await bcrypt.compare(String(pin), driver.pinHash);
    if (!pinMatch) return res.status(401).json({ message: 'Incorrect PIN. Please try again.' });

    const token = signToken({ id: driver._id, type: 'driver' });

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
  } catch (err) {
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// POST /api/driver/location
router.post('/location', protectDriver, async (req, res) => {
  try {
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

    if (global.io) {
      global.io.emit('vehicles:update', {
        id: req.driver._id, vehicleId: req.driver.vehicleId,
        vehicleNumber: req.driver.vehicleNumber, type: req.driver.vehicleType,
        lat, lng, bearing, speed, status: status || 'active',
      });
    }

    res.json({ message: 'Location updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update location.' });
  }
});

// POST /api/driver/duty
router.post('/duty', protectDriver, async (req, res) => {
  try {
    const { onDuty } = req.body;
    await Driver.updateOne({ _id: req.driver._id }, { onDuty, status: onDuty ? 'active' : 'offline' });
    res.json({ message: onDuty ? 'You are now on duty.' : 'You are now off duty.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update duty status.' });
  }
});

// GET /api/driver/me
router.get('/me', protectDriver, (req, res) => {
  res.json({ driver: req.driver });
});

module.exports = router;

const router = require('express').Router();
const { User } = require('../models');
const { protect, signToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { authLimiter } = require('../utils/rateLimiter');

// POST /api/auth/login
// Body: { phone }
// Just enter phone → saved to DB → JWT returned → logged in
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  let { phone, name } = req.body;

  if (!phone || !phone.trim()) {
    logger.warn('Login attempt without phone number');
    return res.status(400).json({ message: 'Phone number is required.' });
  }

  // FIX: Standardize phone cleaning to ensure consistent IDs (no spaces, dashes, or leading zeros)
  const normalizedPhone = phone.trim().replace(/[^0-9+]/g, '');
  if (normalizedPhone.replace(/\D/g, '').length < 10) {
    logger.warn(`Login attempt with invalid phone: ${phone}`);
    return res.status(400).json({ message: 'Please enter a valid 10-digit phone number.' });
  }

  let user = await User.findOne({ phone: normalizedPhone });
  const isNew = !user;

  if (!user) {
    user = await User.create({
      phone: normalizedPhone,
      name: name?.trim() || '',
      lastLogin: new Date(),
    });
    logger.info(`New user registered: ${normalizedPhone}`);
  } else {
    const updateData = { lastLogin: new Date() };
    // FIX: Update name if provided and user currently has no name,
    // ensuring the greeting (Bug #2) works immediately upon login.
    if (name?.trim() && !user.name) {
      updateData.name = name.trim();
      user.name = updateData.name;
    }
    await User.updateOne({ _id: user._id }, updateData);
    logger.info(`User login: ${normalizedPhone}`, { name: user.name });
  }

  // Generate JWT token
  const token = signToken({ id: user._id, type: 'user' });

  res.json({
    message: isNew ? 'Welcome to MoveOn Go!' : 'Welcome back!',
    token,
    user: {
      id:    user._id,
      phone: user.phone,
      name:  user.name,
      email: user.email,
      role:  user.role,
      isNew,
    },
  });
}));

// GET /api/auth/me — get current user
router.get('/me', protect, asyncHandler(async (req, res) => {
  res.json({
    user: {
      id:    req.user._id,
      phone: req.user.phone,
      name:  req.user.name,
      email: req.user.email,
      role:  req.user.role,
    },
  });
}));

// PUT /api/auth/me — update profile
router.put('/me', protect, asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const update = {};
  if (name  !== undefined) update.name  = name.trim();
  if (email !== undefined) update.email = email.trim();

  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
  
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.json({
    message: 'Profile updated.',
    user: { id: user._id, phone: user.phone, name: user.name, email: user.email },
  });
}));

module.exports = router;

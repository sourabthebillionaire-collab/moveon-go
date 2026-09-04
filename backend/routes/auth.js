const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { protect, signToken } = require('../middleware/auth');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { authLimiter } = require('../utils/rateLimiter');

// POST /api/auth/register
// Body: { name, email, password }
router.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ message: 'Email is already registered.' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.create({
    name: name || '',
    email: email.toLowerCase(),
    password: hashedPassword,
    lastLogin: new Date(),
  });

  logger.info(`New user registered: ${email}`);

  const token = signToken({ id: user._id, type: 'user' });

  res.status(201).json({
    message: 'Account created successfully!',
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      isNew: true,
    }
  });
}));

// POST /api/auth/login
// Body: { email, password }
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  user.lastLogin = new Date();
  await user.save();
  logger.info(`User login: ${email}`);

  const token = signToken({ id: user._id, type: 'user' });

  res.json({
    message: 'Welcome back!',
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role,
      isNew: false,
    },
  });
}));

// GET /api/auth/me — get current user
router.get('/me', protect, asyncHandler(async (req, res) => {
  res.json({
    user: {
      id:      req.user._id,
      email:   req.user.email,
      name:    req.user.name,
      picture: req.user.picture,
      phone:   req.user.phone,
      role:    req.user.role,
    },
  });
}));

// PUT /api/auth/me — update profile
router.put('/me', protect, asyncHandler(async (req, res) => {
  const { name, phone } = req.body;
  const update = {};
  if (name  !== undefined) update.name  = name.trim();
  if (phone !== undefined) update.phone = phone.trim();

  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
  
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.json({
    message: 'Profile updated.',
    user: { id: user._id, email: user.email, name: user.name, phone: user.phone, picture: user.picture },
  });
}));

module.exports = router;

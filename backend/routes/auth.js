const router = require('express').Router();
const { User } = require('../models');
const { protect, signToken } = require('../middleware/auth');

// POST /api/auth/login
// Body: { phone }
// Just enter phone → saved to DB → JWT returned → logged in
router.post('/login', async (req, res) => {
  try {
    let { phone, name } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }

    // Clean phone number — keep only digits and +
    phone = phone.trim().replace(/[^0-9+]/g, '');

    // Must be at least 10 digits
    if (phone.replace(/\D/g, '').length < 10) {
      return res.status(400).json({ message: 'Please enter a valid 10-digit phone number.' });
    }

    // Find existing user or create new one
    let user = await User.findOne({ phone });
    const isNew = !user;

    if (!user) {
      user = await User.create({
        phone,
        name: name?.trim() || '',
        lastLogin: new Date(),
      });
    } else {
      await User.updateOne({ _id: user._id }, { lastLogin: new Date() });
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

  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me — get current user
router.get('/me', protect, (req, res) => {
  res.json({
    user: {
      id:    req.user._id,
      phone: req.user.phone,
      name:  req.user.name,
      email: req.user.email,
      role:  req.user.role,
    },
  });
});

// PUT /api/auth/me — update profile
router.put('/me', protect, async (req, res) => {
  try {
    const { name, email } = req.body;
    const update = {};
    if (name  !== undefined) update.name  = name.trim();
    if (email !== undefined) update.email = email.trim();

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    res.json({
      message: 'Profile updated.',
      user: { id: user._id, phone: user.phone, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update profile.' });
  }
});

module.exports = router;

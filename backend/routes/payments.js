/**
 * Payments Route — MoveOn Go
 * POST /api/payments/create-order → create Razorpay order
 *
 * Setup:
 *   npm install razorpay
 *   Add to Render env vars: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
 *   Add to server.js: app.use('/api/payments', require('./routes/payments'));
 */

const router   = require('express').Router();
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errorHandler');
const logger = require('../utils/logger');

// Lazily initialize Razorpay so the app doesn't crash if keys aren't set yet
function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay keys not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in env.');
  }
  const Razorpay = require('razorpay');
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// POST /api/payments/create-order
// Called by BookRide.jsx before opening the Razorpay checkout modal
router.post('/create-order', protect, asyncHandler(async (req, res) => {
  const { amount, currency = 'INR', bookingId } = req.body;

  if (!amount || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ message: 'Invalid amount.' });
  }

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount:   Math.round(Number(amount) * 100), // convert ₹ to paise
      currency,
      receipt:  `moveon_${bookingId || Date.now()}`,
      notes:    { bookingId: String(bookingId || ''), userId: String(req.user._id) },
    });

    logger.info(`Razorpay order created: ${order.id}`, { userId: req.user._id, amount });
    res.json(order);
  } catch (err) {
    logger.error(`Razorpay order failed: ${err.message}`);
    res.status(500).json({ message: 'Payment order creation failed. Try again or use Cash.' });
  }
}));

module.exports = router;

const jwt     = require('jsonwebtoken');
const { User, Driver } = require('../models');

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });
}

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Not authenticated. Please sign in.' });
    }
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Account not found.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token. Please sign in again.' });
  }
}

async function protectDriver(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Driver not authenticated.' });
    }
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'driver') {
      return res.status(401).json({ message: 'Invalid driver token.' });
    }
    const driver = await Driver.findById(decoded.id).select('-pinHash');
    if (!driver || !driver.isActive) {
      return res.status(401).json({ message: 'Driver account not found.' });
    }
    req.driver = driver;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired driver token.' });
  }
}

module.exports = { protect, protectDriver, signToken };

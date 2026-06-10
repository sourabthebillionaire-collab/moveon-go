const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  vehicleType: {
    type: String,
    required: true,
    enum: ['bus', 'auto', 'cab', 'bike']
  },
  pickup: {
    type: String,
    required: true
  },
  dropoff: {
    type: String,
    required: true
  },
  pickupLat: {
    type: Number,
    required: true
  },
  pickupLng: {
    type: Number,
    required: true
  },
  dropoffLat: {
    type: Number,
    required: true
  },
  dropoffLng: {
    type: Number,
    required: true
  },
  fare: String,
  fareAmount: {
    type: Number,
    required: [true, 'Fare amount is required for billing'],
    default: 0,
    min: [0, 'Fare cannot be negative']
  },
  payment: {
    type: String,
    enum: ['Cash', 'Online'],
    default: 'Cash'
  },
  distance: String,
  duration: String,
  status: {
    type: String,
    enum: ['searching', 'accepted', 'started', 'completed', 'cancelled'],
    default: 'searching'
  },
  startOTP: String,
  paid: {
    type: Boolean,
    default: false
  },
  acceptedAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
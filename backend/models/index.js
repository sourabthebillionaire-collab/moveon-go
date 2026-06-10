const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone:     { type: String, required: true, unique: true, trim: true },
  name:      { type: String, trim: true, default: '' },
  email:     { type: String, trim: true, default: '' },
  role:      { type: String, enum: ['passenger', 'admin'], default: 'passenger' },
  isActive:  { type: Boolean, default: true },
  lastLogin: { type: Date, default: Date.now },
  lastSeen:  { type: Date, default: Date.now },
}, { timestamps: true });

const driverSchema = new mongoose.Schema({
  vehicleId:     { type: String, required: true, unique: true, uppercase: true, trim: true },
  name:          { type: String, required: true, trim: true },
  phone:         { type: String, required: true, trim: true },
  email:         { type: String, trim: true, default: '' },
  vehicleType:   { type: String, enum: ['bus', 'auto', 'cab', 'bike'], required: true },
  vehicleNumber: { type: String, required: true, uppercase: true, trim: true },
  pinHash:       { type: String, required: true },
  address:       { type: String, trim: true, default: '' },
  licenseNumber: { type: String, trim: true, default: '' },
  insuranceDoc:  { type: String, trim: true, default: '' },

  // ✅ Bus-specific fields — only used when vehicleType === 'bus'
  busName:       { type: String, trim: true, default: '' }, // e.g. "Bhubaneswar Express"
  routeFrom:     { type: String, trim: true, default: '' }, // e.g. "Bhubaneswar"
  routeTo:       { type: String, trim: true, default: '' }, // e.g. "Cuttack"
  routeNumber:   { type: String, trim: true, default: '' }, // e.g. "Route 12"

  // ✅ Occupancy tracking for buses
  passengers:    { type: Number, default: 0 },
  capacity:      { type: Number, default: 60 },

  isApproved:    { type: Boolean, default: false },
  isActive:      { type: Boolean, default: true },
  rating:        { type: Number, default: 5.0 },
  totalTrips:    { type: Number, default: 0 },
  location: {
    lat:       { type: Number, default: 0 },
    lng:       { type: Number, default: 0 },
    bearing:   { type: Number, default: 0 },
    speed:     { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  onDuty: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'busy', 'offline', 'SOS'], default: 'offline' },
  fcmToken: { type: String, trim: true },
}, { timestamps: true });

const Booking = require('./Booking');

const busRouteSchema = new mongoose.Schema({
  number:    { type: String, required: true, unique: true, uppercase: true },
  from:      { type: String, required: true },
  to:        { type: String, required: true },
  type:      { type: String, enum: ['Regular', 'Express', 'AC'], default: 'Regular' },
  frequency: { type: String, default: 'Every 15 min' },
  isActive:  { type: Boolean, default: true },
  assignedDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Driver' }],
}, { timestamps: true });

module.exports = {
  User:     mongoose.model('User',     userSchema),
  Driver:   mongoose.model('Driver',   driverSchema),
  Booking,
  BusRoute: mongoose.model('BusRoute', busRouteSchema),
};
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone:     { type: String, required: true, unique: true, trim: true },
  name:      { type: String, trim: true, default: '' },
  email:     { type: String, trim: true, default: '' },
  role:      { type: String, enum: ['passenger', 'admin'], default: 'passenger' },
  isActive:  { type: Boolean, default: true },
  lastLogin: { type: Date, default: Date.now },
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
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driverId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Driver' },
  vehicleType:   { type: String, enum: ['auto', 'cab', 'bike'], required: true },
  pickup:        { type: String, required: true },
  pickupLat:     { type: Number },
  pickupLng:     { type: Number },
  dropoff:       { type: String, required: true },
  dropoffLat:    { type: Number },
  dropoffLng:    { type: Number },
  fare:          { type: String, default: '' },
  fareAmount:    { type: Number, default: 0 },
  distance:      { type: String, default: '' },
  duration:      { type: String, default: '' },
  payment:       { type: String, default: 'Cash' },
  status:        { type: String, enum: ['searching', 'accepted', 'started', 'completed', 'cancelled'], default: 'searching' },
  acceptedAt:    { type: Date },
  completedAt:   { type: Date },
}, { timestamps: true });

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
  Booking:  mongoose.model('Booking',  bookingSchema),
  BusRoute: mongoose.model('BusRoute', busRouteSchema),
};

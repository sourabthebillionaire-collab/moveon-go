/**
 * Joi Validation Schemas
 * Centralized input validation for all API endpoints
 */

const joi = require('joi');

// ── Auth Schemas ──────────────────────────────────────────────
const phoneSchema = joi.object({
  phone: joi.string().regex(/^[0-9+\-\s()]{10,}$/).required().messages({
    'string.pattern.base': 'Phone must be valid',
    'any.required': 'Phone is required',
  }),
  name: joi.string().max(100).optional(),
});

const otpSchema = joi.object({
  phone: joi.string().regex(/^[0-9+\-\s()]{10,}$/).required(),
  otp: joi.string().length(6).required().messages({
    'string.length': 'OTP must be 6 digits',
  }),
});

const profileUpdateSchema = joi.object({
  name: joi.string().max(100).optional(),
  email: joi.string().email().optional(),
  avatar: joi.string().uri().optional(),
});

// ── Driver Schemas ────────────────────────────────────────────
const driverRegisterSchema = joi.object({
  name: joi.string().min(3).max(100).required(),
  phone: joi.string().regex(/^[0-9+\-\s()]{10,}$/).required(),
  email: joi.string().email().optional().allow(''), // Made optional to align with driver.js
  vehicleType: joi.string().valid('auto', 'cab', 'bike', 'bus').required(), // Added 'bus'
  vehicleNumber: joi.string().min(5).max(20).required(),
  pin: joi.string().length(4).required().messages({
    'string.length': 'PIN must be 4 digits',
  }),
  licenseNumber: joi.string().min(8).max(20).required(), // Kept as required
  // aadharNumber is not stored in the Driver model, so removed from schema
});

const driverLoginSchema = joi.object({
  vehicleId: joi.string().min(5).required(),
  pin: joi.string().length(4).required(),
});

const locationUpdateSchema = joi.object({
  lat: joi.number().required(),
  lng: joi.number().required(),
  bearing: joi.number().optional(),
  speed: joi.number().optional(),
});

const dutySchema = joi.object({
  onDuty: joi.boolean().required(),
});

// ── Booking Schemas ──────────────────────────────────────────
const bookingCreateSchema = joi.object({
  type: joi.string().valid('auto', 'cab', 'bike').required(),
  pickup: joi.string().required(),
  pickupCoords: joi.object({
    lat: joi.number().required(),
    lng: joi.number().required(),
  }).required(),
  dropoff: joi.string().required(),
  dropoffCoords: joi.object({
    lat: joi.number().required(),
    lng: joi.number().required(),
  }).required(),
  fare: joi.string().optional(),
  fareAmount: joi.number().min(0).required(), // Ensure fareAmount is non-negative
  payment: joi.string().valid('cash', 'card', 'wallet').required(),
  distance: joi.string().optional(),
  duration: joi.string().optional(),
});

// ── Fare Schemas ──────────────────────────────────────────────
const fareEstimateSchema = joi.object({
  from: joi.object({
    lat: joi.number().required(),
    lng: joi.number().required(),
  }).required(),
  to: joi.object({
    lat: joi.number().required(),
    lng: joi.number().required(),
  }).required(),
  vehicleType: joi.string().valid('auto', 'cab', 'bike').required(),
});

// ── Rides Schemas ────────────────────────────────────────────
const rideRespondSchema = joi.object({
  action: joi.string().valid('accept', 'decline').required(),
});

// ── Vehicles Schemas ─────────────────────────────────────────
const nearbyVehiclesSchema = joi.object({
  lat: joi.number().required(),
  lng: joi.number().required(),
  type: joi.string().valid('all', 'auto', 'cab', 'bike').optional().default('all'),
});

module.exports = {
  phoneSchema,
  otpSchema,
  profileUpdateSchema,
  driverRegisterSchema,
  driverLoginSchema,
  locationUpdateSchema,
  dutySchema,
  bookingCreateSchema,
  fareEstimateSchema,
  rideRespondSchema,
  nearbyVehiclesSchema,
};

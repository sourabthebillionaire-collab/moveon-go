/**
 * API Service — MoveOn Go
 * All backend communication lives here.
 * Set VITE_API_URL in .env to connect your backend.
 * Default: http://localhost:3001/api
 */

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const REQUEST_TIMEOUT = 10000; // 10 seconds

async function request(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data.message || `Request failed: ${res.status}`);
      err.status = res.status;
      err.data   = data;
      throw err;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout (${REQUEST_TIMEOUT}ms). Please check your connection.`);
    }
    throw error;
  }
}

const get    = (path, token)       => request('GET',    path, null, token);
const post   = (path, body, token) => request('POST',   path, body, token);
const put    = (path, body, token) => request('PUT',    path, body, token);
const del    = (path, token)       => request('DELETE', path, null, token);

// ── Auth ─────────────────────────────────────────────────────────
export const api = {

  // Send OTP to phone
  sendOTP: (phone) =>
    post('/auth/send-otp', { phone }),

  // Verify OTP → returns { token, user }
  verifyOTP: (phone, otp) =>
    post('/auth/verify-otp', { phone, otp }),

  // Get current user profile
  getProfile: (token) =>
    get('/auth/me', token),

  // Update profile
  updateProfile: (data, token) =>
    put('/auth/me', data, token),

  // ── Driver Auth ──────────────────────────────────────────────
  // Validate vehicle ID exists in system
  validateVehicleId: (vehicleId) =>
    get(`/driver/validate/${vehicleId}`),

  // Driver login with vehicle ID + PIN → returns { token, driver }
  driverLogin: (vehicleId, pin) =>
    post('/driver/login', { vehicleId, pin }),

  // Register new driver (admin approves)
  driverRegister: (data) =>
    post('/driver/register', data),

  // Update driver location (called every N seconds)
  updateDriverLocation: (data, token) =>
    post('/driver/location', data, token),

  // Driver go on/off duty
  setDriverDuty: (onDuty, token) =>
    post('/driver/duty', { onDuty }, token),

  // Accept / decline a ride request
  respondToRide: (rideId, action, token) =>
    post(`/rides/${rideId}/respond`, { action }, token),

  // ── Vehicles / Buses ─────────────────────────────────────────
  // Get all active vehicles near a location
  getNearbyVehicles: (lat, lng, type = 'all') =>
    get(`/vehicles/nearby?lat=${lat}&lng=${lng}&type=${type}`),

  // Get live buses on a route
  getBusRoute: (routeId) =>
    get(`/buses/route/${routeId}`),

  // Get all bus routes
  getBusRoutes: () =>
    get('/buses/routes'),

  // Get single vehicle location
  getVehicle: (vehicleId) =>
    get(`/vehicles/${vehicleId}`),

  // ── Bookings ─────────────────────────────────────────────────
  // Create a new ride booking
  createBooking: (data, token) =>
    post('/bookings', data, token),

  // Get user's booking history
  getBookings: (token) =>
    get('/bookings', token),

  // Cancel a booking
  cancelBooking: (bookingId, token) =>
    del(`/bookings/${bookingId}`, token),

  // Get active booking (if any)
  getActiveBooking: (token) =>
    get('/bookings/active', token),

  // ── Fare ─────────────────────────────────────────────────────
  // Get fare estimate from backend (uses real traffic data)
  getFareEstimate: (from, to, vehicleType) =>
    post('/fare/estimate', { from, to, vehicleType }),

};

export default api;
